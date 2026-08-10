import { resolveClientUrl } from '@peanut-admin/admin/client'
import type { ClientHeaders, ClientTransport, ClientTransportRequest } from '@peanut-admin/admin/client'

export interface UniAppClientResponse {
  readonly data: unknown
}

export interface UniAppClientRequestOptions {
  readonly url: string
  readonly method: string
  readonly data?: unknown
  readonly header: Record<string, string>
  readonly success?: (response: UniAppClientResponse) => void
  readonly fail?: (error: unknown) => void
}

export type UniAppClientRequest = (
  options: UniAppClientRequestOptions,
) => void

export interface UniAppClientTransportOptions {
  readonly baseUrl: string
  readonly request: UniAppClientRequest
}

const headersRecord = (headers: ClientHeaders): Record<string, string> => {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export const createUniAppClientTransport = (
  options: UniAppClientTransportOptions,
): ClientTransport => async (request: ClientTransportRequest): Promise<unknown> => (
  new Promise<unknown>((resolve, reject) => {
    const method = request.method.toUpperCase()
    const requestOptions: UniAppClientRequestOptions = {
      url: resolveClientUrl(options.baseUrl, request.path),
      method,
      ...(request.data !== undefined ? { data: request.data } : {}),
      header: headersRecord(request.headers),
      success: response => resolve(response.data),
      fail: error => reject(error),
    }

    options.request(requestOptions)
  })
)
