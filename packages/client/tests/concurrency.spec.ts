import { describe, expect, it } from 'vitest';
import {
  createRevisionedRequestCache,
  createSingleFlight,
  fetchAllPagesConcurrently,
} from '../src/index.js';

describe('concurrency helpers', () => {
  it('deduplicates concurrent single-flight calls and clears after settlement', async () => {
    const sf = createSingleFlight<number>();
    let calls = 0;

    const [a, b] = await Promise.all([
      sf.run('k1', async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return 42;
      }),
      sf.run('k1', async () => {
        calls += 1;
        return 99;
      }),
    ]);

    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(calls).toBe(1);
    expect(sf.has('k1')).toBe(false);
  });

  it('fetches remaining pages concurrently with bounded concurrency and respects maxPages', async () => {
    let active = 0;
    let peak = 0;
    const requested: number[] = [];

    const outcome = await fetchAllPagesConcurrently({
      pageSize: 2,
      concurrency: 2,
      maxPages: 4,
      fetchPage: async (pageNo) => {
        requested.push(pageNo);
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 10));
        active -= 1;
        return {
          items: [pageNo * 10 + 1, pageNo * 10 + 2],
          total: 10,
        };
      },
    });

    expect(outcome.aborted).toBe(false);
    expect(outcome.truncated).toBe(true);
    expect(outcome.pagesFetched).toBe(4);
    expect(outcome.items).toEqual([11, 12, 21, 22, 31, 32, 41, 42]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(requested[0]).toBe(1);
  });

  it('caches values by scopeKey with TTL expiration and scope invalidation', async () => {
    let clock = 1_000;
    let loads = 0;
    const cache = createRevisionedRequestCache<string>({
      ttlMs: 500,
      maxEntries: 2,
      now: () => clock,
    });

    const v1 = await cache.getOrLoad('t1:rev1', 'menus', async () => {
      loads += 1;
      return 'v1';
    });
    const v1Again = await cache.getOrLoad('t1:rev1', 'menus', async () => {
      loads += 1;
      return 'should-not-load';
    });
    expect(v1).toBe('v1');
    expect(v1Again).toBe('v1');
    expect(loads).toBe(1);

    clock += 600;
    const v2 = await cache.getOrLoad('t1:rev1', 'menus', async () => {
      loads += 1;
      return 'v2';
    });
    expect(v2).toBe('v2');
    expect(loads).toBe(2);

    cache.invalidateScope('t1:rev1');
    expect(cache.get('t1:rev1', 'menus')).toBeUndefined();
  });
});
