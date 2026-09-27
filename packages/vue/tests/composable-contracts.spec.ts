import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  useAccess,
  useAsyncAction,
  useAsyncList,
  usePlatformContext,
  useTenantContext,
} from '../src/index';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};

describe('composable source contracts', () => {
  it.each([
    { directory: 'access', name: 'useAccess' },
    { directory: 'data', name: 'useAsyncList' },
    { directory: 'data', name: 'useAsyncAction' },
  ])('uses an exact $name.ts entry', ({ directory, name }) => {
    const parent = new URL(`../src/${directory}/`, import.meta.url);
    // Check directory entries, not case-insensitive filesystem resolution.
    expect(readdirSync(parent)).toContain(`${name}.ts`);
    const source = readFileSync(new URL(`${name}.ts`, parent), 'utf8');
    expect(source).toMatch(new RegExp(`export const ${name}\\b`));
    const entry = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    expect(entry).toContain(`'./${directory}/${name}.js'`);
  });

  it('does not retain the obsolete combined async module', () => {
    expect(existsSync(new URL('../src/data/async-state.ts', import.meta.url))).toBe(false);
  });
});

describe('live permission hints', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('reflects tenant grants, replacement and logout without recreating hints', () => {
    const context = useTenantContext();
    const hints = useAccess();
    expect(hints.can('core.member.read')).toBe(false);
    context.replace({
      audience: 'tenant',
      accountId: '1',
      tenantId: '10',
      memberId: '20',
      moduleKeys: ['core'],
      permissionKeys: ['core.member.read'],
      authorizationRevision: '1',
    });
    expect(hints.can('core.member.read')).toBe(true);
    expect(hints.canAll(['core.member.read'])).toBe(true);
    context.replace({
      ...context.value!,
      permissionKeys: ['core.member.update'],
      authorizationRevision: '2',
    });
    expect(hints.can('core.member.read')).toBe(false);
    expect(hints.can('core.member.update')).toBe(true);
    expect(hints.canAll(['core.member.read', 'core.member.update'])).toBe(false);
    context.clear();
    expect(hints.can('core.member.update')).toBe(false);
    expect(hints.can('*')).toBe(false);
  });

  it('reflects platform revocation without reading tenant permissions', () => {
    const platform = usePlatformContext();
    platform.replace({
      audience: 'platform',
      accountId: '1',
      operatorId: '2',
      permissionKeys: ['platform.tenant.read'],
      authorizationRevision: '1',
    });
    const hints = useAccess('platform');
    expect(hints.can('platform.tenant.read')).toBe(true);
    useTenantContext().replace({
      audience: 'tenant',
      accountId: '1',
      tenantId: '10',
      memberId: '20',
      moduleKeys: ['core'],
      permissionKeys: ['core.member.read'],
      authorizationRevision: '1',
    });
    expect(hints.can('core.member.read')).toBe(false);
    platform.clear();
    expect(hints.can('platform.tenant.read')).toBe(false);
    expect(hints.canAll(['platform.tenant.read'])).toBe(false);
  });
});

describe('migrated async composable behavior', () => {
  it('aborts list work and rejects late results when its scope stops', async () => {
    const pending = deferred<{
      items: string[];
      total: number;
      page: number;
      pageSize: number;
    }>();
    let signal: AbortSignal | undefined;
    const scope = effectScope();
    const state = scope.run(() => useAsyncList({
      initialFilters: {},
      initialPageSize: 10,
      load: (query) => {
        signal = query.signal;
        return pending.promise;
      },
      errorMessage: () => 'LOAD_FAILED',
    }))!;
    const request = state.load();
    scope.stop();
    expect(signal?.aborted).toBe(true);
    pending.resolve({ items: ['late'], total: 1, page: 1, pageSize: 10 });
    await expect(request).resolves.toBe(false);
    expect(state.items.value).toEqual([]);
    expect(state.loading.value).toBe(false);
  });

  it('keeps a list failure distinct from an empty successful result', async () => {
    const scope = effectScope();
    try {
      const state = scope.run(() => useAsyncList({
        initialFilters: {},
        initialPageSize: 10,
        load: async () => { throw new Error('private upstream detail'); },
        errorMessage: () => 'LOAD_FAILED',
      }))!;
      await expect(state.load()).resolves.toBe(false);
      expect(state.error.value).toBe('LOAD_FAILED');
      expect(state.loading.value).toBe(false);
    } finally {
      scope.stop();
    }
  });

  it('cancels an action and permits a fresh submission without late failure writes', async () => {
    const scope = effectScope();
    try {
      const pending = deferred<string>();
      const state = scope.run(() => useAsyncAction(() => 'SUBMIT_FAILED'))!;
      const request = state.run(() => pending.promise);
      state.cancel();
      await expect(state.run(async () => 'fresh')).resolves.toEqual({
        status: 'completed', data: 'fresh',
      });
      pending.reject(new Error('late private upstream detail'));
      await expect(request).resolves.toEqual({ status: 'cancelled' });
      expect(state.error.value).toBeNull();
      expect(state.loading.value).toBe(false);
    } finally {
      scope.stop();
    }
  });
});
