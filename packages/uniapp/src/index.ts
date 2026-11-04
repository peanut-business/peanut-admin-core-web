import { clientAbortError, resolveClientUrl } from '@peanut-admin/client';
import type {
  ClientHeaders,
  ClientRequestMethod,
  ClientTransport,
  ClientTransportRequest,
} from '@peanut-admin/client';

export interface UniAppClientResponse {
  readonly data: unknown;
}

export type UniAppClientRequestMethod = Exclude<ClientRequestMethod, 'PATCH'>;

export interface UniAppClientRequestOptions<TData = unknown> {
  readonly url: string;
  readonly method: UniAppClientRequestMethod;
  readonly data?: TData;
  readonly header: Record<string, string>;
  readonly success?: (response: UniAppClientResponse) => void;
  readonly fail?: (error: unknown) => void;
}

export interface UniAppRequestTask {
  abort: () => void;
}

export type UniAppClientRequest<TData = unknown> = (
  options: UniAppClientRequestOptions<TData>
) => UniAppRequestTask;

export interface UniAppClientTransportOptions<TData = unknown> {
  readonly baseUrl: string;
  readonly request: UniAppClientRequest<TData>;
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
  <TData = unknown>(
    options: UniAppClientTransportOptions<TData>
  ): ClientTransport<TData> =>
  async (request: ClientTransportRequest<TData>): Promise<unknown> =>
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
      // uni.request has no portable PATCH support across its target platforms.
      if (request.method === 'PATCH') {
        reject(new Error('UNIAPP_REQUEST_METHOD_INVALID'));
        return;
      }
      const requestOptions: UniAppClientRequestOptions<TData> = {
        url: resolveClientUrl(options.baseUrl, request.path),
        method: request.method,
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
