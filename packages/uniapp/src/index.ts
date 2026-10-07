import { clientAbortError, resolveClientUrl } from '@peanut-admin/client';
import type {
  ClientHeaders,
  ClientTransport,
  ClientTransportRequest,
} from '@peanut-admin/client';

export interface UniAppClientResponse {
  readonly data: unknown;
}

export interface UniAppClientRequestOptions {
  readonly url: string;
  readonly method: string;
  readonly data?: unknown;
  readonly header: Record<string, string>;
  readonly success?: (response: UniAppClientResponse) => void;
  readonly fail?: (error: unknown) => void;
}

export interface UniAppRequestTask {
  abort: () => void;
}

export type UniAppClientRequest = (
  options: UniAppClientRequestOptions
) => UniAppRequestTask;

export interface UniAppClientTransportOptions {
  readonly baseUrl: string;
  readonly request: UniAppClientRequest;
}

const headersRecord = (headers: ClientHeaders): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

/**
 * Bridges the shared request contract to uni.request, including cancellation.
 */
export const createUniAppClientTransport =
  (options: UniAppClientTransportOptions): ClientTransport =>
  async (request: ClientTransportRequest): Promise<unknown> =>
    new Promise<unknown>((resolve, reject) => {
      if (request.signal?.aborted) {
        reject(clientAbortError());
        return;
      }
      let settled = false;
      let task: UniAppRequestTask | undefined;
      let abortRequested = false;
      const abortTask = () => {
        try {
          task?.abort();
        } catch {
          // An aborting task cannot replace the cancellation result.
        }
      };
      const finish = (outcome: () => void) => {
        if (settled) return;
        settled = true;
        request.signal?.removeEventListener('abort', abort);
        outcome();
      };
      const abort = () => {
        if (settled) return;
        abortRequested = true;
        finish(() => reject(clientAbortError()));
        abortTask();
      };
      const method = request.method.toUpperCase();
      const requestOptions: UniAppClientRequestOptions = {
        url: resolveClientUrl(options.baseUrl, request.path),
        method,
        ...(request.data !== undefined ? { data: request.data } : {}),
        header: headersRecord(request.headers),
        success: (response) => finish(() => resolve(response.data)),
        fail: (error) => finish(() => reject(error)),
      };

      request.signal?.addEventListener('abort', abort, { once: true });
      if (request.signal?.aborted) {
        abort();
        return;
      }
      try {
        task = options.request(requestOptions);
        if (abortRequested) abortTask();
      } catch (error) {
        finish(() => reject(error));
      }
    });
