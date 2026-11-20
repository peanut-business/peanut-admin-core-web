import { raceAbortSignal } from './concurrency.js';
import { ClientRequestError, createPeanutEnvelopeDecoder } from './index.js';

export interface DownloadBlobOptions {
  signal?: AbortSignal;
  filename?: string;
}

/** Decode the server-provided name without allowing path or control characters. */
export const downloadFilename = (disposition: string | null, fallback = 'download'): string => {
  const extended = disposition?.match(/(?:^|;)\s*filename\*\s*=\s*([^;]+)/i)?.[1]?.trim();
  const plain = disposition?.match(/(?:^|;)\s*filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i)?.[1]?.trim();
  let name = plain?.replace(/^"|"$/g, '').replace(/\\(.)/g, '$1');
  if (extended) {
    const value = extended.replace(/^"|"$/g, '').replace(/^[^']*'[^']*'/, '');
    try { name = decodeURIComponent(value); } catch { /* use plain filename */ }
  }
  const safe = (name || fallback).replace(/[\u0000-\u001f\u007f/\\:]/g, '_').replace(/^\.+$/, '_').trim();
  return safe || 'download';
};

export const downloadBlob = async (
  source: Response | ((signal?: AbortSignal) => Promise<Response>),
  options: DownloadBlobOptions = {}
): Promise<{ blob: Blob; filename: string }> => {
  await raceAbortSignal(Promise.resolve(), options.signal);
  const response = await raceAbortSignal(typeof source === 'function' ? source(options.signal) : Promise.resolve(source), options.signal);
  const type = response.headers.get('content-type') ?? '';
  if (type.toLowerCase().includes('json')) {
    let raw: unknown;
    try { raw = await raceAbortSignal(response.json(), options.signal); }
    catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      throw new ClientRequestError('decoder', 'INVALID_RESPONSE', 'The JSON response could not be understood.');
    }
    const decoded = await createPeanutEnvelopeDecoder()(raw, { path: '/', method: 'GET', headers: new Headers() });
    if (decoded.kind !== 'success') throw new ClientRequestError(decoded.kind, decoded.code ?? 'CLIENT_BUSINESS_ERROR', decoded.message ?? 'The request failed.');
    throw new ClientRequestError('business', 'INVALID_DOWNLOAD', 'The response did not contain a file.');
  }
  if (!response.ok) throw new ClientRequestError('transport', `HTTP_${response.status}`, response.statusText || 'The download failed.');
  const blob = await raceAbortSignal(response.blob(), options.signal);
  return { blob, filename: downloadFilename(response.headers.get('content-disposition'), options.filename) };
};

export const createAbortScope = () => {
  let controller = new AbortController();
  return {
    get signal() { return controller.signal; },
    abort: (reason?: unknown) => controller.abort(reason),
    reset: () => { controller.abort(); controller = new AbortController(); return controller.signal; },
  };
};
