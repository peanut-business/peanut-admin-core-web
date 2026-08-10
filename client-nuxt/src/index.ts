import { resolveClientUrl } from '@peanut-admin/admin/client'
import type { ClientHeaders, ClientTransport, ClientTransportRequest } from '@peanut-admin/admin/client'

export interface NuxtClientFetchOptions {
  readonly method?: string
  readonly query?: unknown
  readonly body?: unknown
  readonly headers?: Record<string, string>
}

export type NuxtClientFetch = (
  url: string,
  options?: NuxtClientFetchOptions,
) => Promise<unknown>

export interface NuxtClientTransportOptions {
  readonly baseUrl: string
  readonly $fetch: NuxtClientFetch
}

const isQueryMethod = (method: string): boolean => method === 'GET' || method === 'DELETE'

const headersRecord = (headers: ClientHeaders): Record<string, string> => {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export const createNuxtClientTransport = (
  options: NuxtClientTransportOptions,
): ClientTransport => {
  return async (request: ClientTransportRequest): Promise<unknown> => {
    const method = request.method.toUpperCase()
    const url = resolveClientUrl(options.baseUrl, request.path)
    const fetchOptions: NuxtClientFetchOptions = {
      method,
      headers: headersRecord(request.headers),
      ...(request.data !== undefined
        ? isQueryMethod(method)
          ? { query: request.data }
          : { body: request.data }
        : {}),
    }
    return options.$fetch(url, fetchOptions)
  }
}
