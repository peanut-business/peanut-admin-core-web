import { describe, expect, it, vi } from 'vitest';
import { createClient, createPeanutEnvelopeDecoder, downloadBlob } from '../src/index';

describe('download and write coordination', () => {
  it('decodes and sanitizes Unicode filenames and handles envelope errors', async () => {
    const response = new Response('file', { headers: { 'Content-Disposition': "attachment; filename*=UTF-8''%E6%8A%A5%E8%A1%A8%2F2026.csv" } });
    expect((await downloadBlob(response)).filename).toBe('报表_2026.csv');
    await expect(downloadBlob(new Response(JSON.stringify({ code: 12, msg: 'denied' }), { headers: { 'Content-Type': 'application/json' } }))).rejects.toMatchObject({ kind: 'business', message: 'denied' });
    const controller = new AbortController(); controller.abort();
    await expect(downloadBlob(new Response('x'), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('deduplicates only explicit equivalent writes and isolates aborted waiters', async () => {
    let resolve!: (value: unknown) => void;
    const transport = vi.fn(() => new Promise<unknown>(done => { resolve = done; }));
    const client = createClient({ transport, session: { accessToken: () => 'token', clear: () => {} }, decoder: createPeanutEnvelopeDecoder() });
    const controller = new AbortController();
    const first = client.request({ path: '/x', method: 'POST', data: { id: 1 }, dedupeKey: 'one', signal: controller.signal });
    const second = client.request({ path: '/x', method: 'POST', data: { id: 1 }, dedupeKey: 'one' });
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await rejected;
    expect(transport).toHaveBeenCalledTimes(1);
    resolve({ code: 0, data: 'ok' });
    await expect(second).resolves.toBe('ok');
  });
});
