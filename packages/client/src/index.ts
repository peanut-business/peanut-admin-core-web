export type ClientRequestMethod =
  | 'DELETE'
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'
  | 'POST'
  | 'PUT'

export interface ClientHeaderSource {
  forEach: (callback: (value: string, key: string) => void) => void
}

export type ClientRequestHeaders =
  | Readonly<Record<string, string>>
  | ReadonlyArray<readonly [string, string]>
  | ClientHeaderSource

export interface ClientHeaders extends ClientHeaderSource {
  delete: (name: string) => void
  get: (name: string) => string | null
  has: (name: string) => boolean
  set: (name: string, value: string) => void
}

export interface ClientRequest<TData = unknown> {
  readonly path: string
  readonly method?: ClientRequestMethod
  readonly data?: TData
  readonly headers?: ClientRequestHeaders
  readonly auth?: boolean
}

export interface ClientTransportRequest<TData = unknown> {
  readonly path: string
  readonly method: ClientRequestMethod
  readonly data?: TData
  readonly headers: ClientHeaders
}

export type ClientTransport = (request: ClientTransportRequest) => Promise<unknown>

export interface ClientSession {
  accessToken: () => string | null | undefined
  clear: () => void | Promise<void>
}

export interface ClientDecodeSuccess<TData = unknown> {
  readonly kind: 'success'
  readonly data: TData
}

export interface ClientDecodeUnauthorized {
  readonly kind: 'unauthorized'
  readonly code?: string
  readonly message?: string
}

export interface ClientDecodeBusiness {
  readonly kind: 'business'
  readonly code?: string
  readonly message?: string
}

export type ClientDecodeResult<TData = unknown> =
  | ClientDecodeSuccess<TData>
  | ClientDecodeUnauthorized
  | ClientDecodeBusiness

export type ClientDecoder<TData = unknown> = (
  response: unknown,
  request: ClientTransportRequest,
) => ClientDecodeResult<TData> | Promise<ClientDecodeResult<TData>>

export type ClientRequestErrorKind =
  | 'business'
  | 'decoder'
  | 'path'
  | 'session'
  | 'transport'
  | 'unauthorized'

export class ClientRequestError extends Error {
  readonly kind: ClientRequestErrorKind
  readonly code: string

  constructor(kind: ClientRequestErrorKind, code: string, message: string) {
    super(message)
    this.name = 'ClientRequestError'
    this.kind = kind
    this.code = code
  }
}

export interface ClientHooks {
  readonly unauthorized?: (error: ClientRequestError) => void | Promise<void>
  readonly businessError?: (error: ClientRequestError) => void | Promise<void>
}

export interface ClientOptions {
  readonly transport: ClientTransport
  readonly session: ClientSession
  readonly decoder: ClientDecoder
  readonly hooks?: ClientHooks
}

export interface Client {
  request: <TData = unknown>(request: ClientRequest) => Promise<TData>
}

const pathControlCharacters = /[\u0000-\u001f\u007f]/
const controlCharacters = /[\u0000-\u001f\u007f]/g
const encodedUnsafePathSegment = /%(?:2e|2f|5c)/i
const absolutePath = /^[A-Za-z][A-Za-z0-9+.-]*:/
const httpBaseUrl = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i
const validHeaderName = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const invalidHeaderValue = /[\u0000\r\n]/
const safeCode = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/
const defaultUnauthorizedCode = 'CLIENT_UNAUTHORIZED'
const defaultBusinessCode = 'CLIENT_BUSINESS_ERROR'
const genericUnauthorizedMessage = 'Authentication is required.'
const genericBusinessMessage = 'The request was rejected.'

const invalidPath = (): ClientRequestError => (
  new ClientRequestError('path', 'CLIENT_PATH_INVALID', 'The request path is invalid.')
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const assertClientPath = (path: string): void => {
  if (
    typeof path !== 'string'
    || path === ''
    || path.trim() !== path
    || path.startsWith('//')
    || absolutePath.test(path)
    || path.includes('\\')
    || pathControlCharacters.test(path)
    || encodedUnsafePathSegment.test(path)
  ) {
    throw invalidPath()
  }

  const pathname = path.split(/[?#]/u, 1)[0] ?? ''
  if (pathname === '' || pathname.split('/').some(segment => segment === '.' || segment === '..')) {
    throw invalidPath()
  }
}

const invalidBaseUrl = (): ClientRequestError => (
  new ClientRequestError('path', 'CLIENT_BASE_URL_INVALID', 'The client base URL is invalid.')
)

const validBaseUrl = (baseUrl: string): { origin: string; pathname: string } => {
  if (
    typeof baseUrl !== 'string'
    || baseUrl.trim() !== baseUrl
    || pathControlCharacters.test(baseUrl)
    || baseUrl.includes('\\')
  ) {
    throw invalidBaseUrl()
  }

  const match = httpBaseUrl.exec(baseUrl)
  const protocol = match?.[1]
  const authority = match?.[2]
  const pathname = match?.[3] ?? '/'
  if (
    protocol === undefined
    || authority === undefined
    || authority === ''
    || authority.includes('@')
    || /\s/.test(authority)
    || encodedUnsafePathSegment.test(pathname)
    || pathname.split('/').some(segment => segment === '.' || segment === '..')
  ) {
    throw invalidBaseUrl()
  }

  return {
    origin: `${protocol.toLowerCase()}://${authority}`,
    pathname,
  }
}

export const resolveClientUrl = (baseUrl: string, path: string): string => {
  assertClientPath(path)
  const base = validBaseUrl(baseUrl)
  const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`
  return path.startsWith('/')
    ? `${base.origin}${path}`
    : `${base.origin}${basePath}${path}`
}

const safeMessage = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string' || value.trim() === '') return fallback
  const normalized = value.replace(controlCharacters, ' ').trim()
  return normalized === '' ? fallback : normalized.slice(0, 512)
}

const safeErrorCode = (value: unknown, fallback: string): string => (
  typeof value === 'string' && safeCode.test(value) ? value : fallback
)

const decodeKind = (value: unknown): string | null => {
  if (!isRecord(value)) return null
  const candidate = value.kind
  return typeof candidate === 'string' ? candidate : null
}

const isDecodedResult = (value: unknown): value is ClientDecodeResult => {
  const kind = decodeKind(value)
  if (kind === 'success') return isRecord(value) && 'data' in value
  if (kind === 'unauthorized' || kind === 'business') return isRecord(value)
  return false
}

const normalizedDecodedResult = (value: ClientDecodeResult): ClientDecodeResult => {
  const kind = decodeKind(value)
  if (kind === 'success') return { kind: 'success', data: (value as ClientDecodeSuccess).data }
  if (kind === 'unauthorized') {
    const result = value as ClientDecodeUnauthorized
    return {
      kind: 'unauthorized',
      code: safeErrorCode(result.code, defaultUnauthorizedCode),
      message: safeMessage(result.message, genericUnauthorizedMessage),
    }
  }

  const result = value as ClientDecodeBusiness
  return {
    kind: 'business',
    code: safeErrorCode(result.code, defaultBusinessCode),
    message: safeMessage(result.message, genericBusinessMessage),
  }
}

const isHeaderSource = (value: unknown): value is ClientHeaderSource => (
  typeof value === 'object'
  && value !== null
  && typeof (value as { forEach?: unknown }).forEach === 'function'
)

class PortableClientHeaders implements ClientHeaders {
  private readonly values = new Map<string, string>()

  constructor(headers?: ClientRequestHeaders) {
    if (headers === undefined) return

    if (Array.isArray(headers)) {
      for (const entry of headers) {
        if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError('invalid header entry')
        this.set(entry[0], entry[1])
      }
      return
    }

    if (isHeaderSource(headers)) {
      headers.forEach((value, key) => this.set(key, value))
      return
    }

    if (typeof headers === 'object' && headers !== null) {
      for (const [key, value] of Object.entries(headers)) this.set(key, value)
      return
    }

    throw new TypeError('invalid headers')
  }

  delete(name: string): void {
    this.values.delete(name.toLowerCase())
  }

  get(name: string): string | null {
    return this.values.get(name.toLowerCase()) ?? null
  }

  has(name: string): boolean {
    return this.values.has(name.toLowerCase())
  }

  set(name: string, value: string): void {
    if (!validHeaderName.test(name) || typeof value !== 'string' || invalidHeaderValue.test(value)) {
      throw new TypeError('invalid header')
    }
    this.values.set(name.toLowerCase(), value.trim())
  }

  forEach(callback: (value: string, key: string) => void): void {
    this.values.forEach((value, key) => callback(value, key))
  }
}

const requestHeaders = (headers: ClientRequestHeaders | undefined): ClientHeaders => {
  const result = new PortableClientHeaders(headers)
  // Header names are normalized, so delete removes every caller spelling.
  result.delete('Authorization')
  return result
}

const methodOf = (method: ClientRequestMethod | undefined): ClientRequestMethod => (
  (method ?? 'GET').toUpperCase() as ClientRequestMethod
)

const requestError = (kind: ClientRequestErrorKind, code: string, message: string): ClientRequestError => (
  new ClientRequestError(kind, safeErrorCode(code, `CLIENT_${kind.toUpperCase()}_ERROR`), safeMessage(message, 'The request could not be completed.'))
)

export const createClient = (options: ClientOptions): Client => {
  let unauthorizedHandling: Promise<void> | null = null

  const invokeUnauthorized = async (error: ClientRequestError): Promise<void> => {
    if (unauthorizedHandling === null) {
      unauthorizedHandling = (async () => {
        try {
          await options.session.clear()
        } catch {
          throw requestError('session', 'CLIENT_SESSION_CLEAR_ERROR', 'The client session could not be cleared.')
        }
        try {
          await options.hooks?.unauthorized?.(error)
        } catch {
          // Hook failures cannot turn an unauthorized response into success.
        }
      })().finally(() => {
        unauthorizedHandling = null
      })
    }

    await unauthorizedHandling
  }

  const request = async <TData = unknown>(input: ClientRequest): Promise<TData> => {
    try {
      assertClientPath(input.path)
    } catch (error) {
      if (error instanceof ClientRequestError) throw error
      throw invalidPath()
    }

    const method = methodOf(input.method)
    let headers: ClientHeaders
    try {
      headers = requestHeaders(input.headers)
    } catch {
      throw requestError('path', 'CLIENT_HEADERS_INVALID', 'The request headers are invalid.')
    }

    if (input.auth !== false) {
      let token: string | null | undefined
      try {
        token = options.session.accessToken()
      } catch {
        throw requestError('session', 'CLIENT_SESSION_ERROR', 'The client session is unavailable.')
      }
      if (typeof token === 'string' && token !== '') headers.set('Authorization', `Bearer ${token}`)
    }

    const transportRequest: ClientTransportRequest = {
      path: input.path,
      method,
      ...(input.data !== undefined ? { data: input.data } : {}),
      headers,
    }

    let response: unknown
    try {
      response = await options.transport(transportRequest)
    } catch {
      throw requestError('transport', 'CLIENT_TRANSPORT_ERROR', 'The request could not be completed.')
    }

    let decoded: ClientDecodeResult
    try {
      decoded = await options.decoder(response, transportRequest)
      if (!isDecodedResult(decoded)) throw new Error('invalid decoder result')
      decoded = normalizedDecodedResult(decoded)
    } catch {
      throw requestError('decoder', 'CLIENT_DECODER_INVALID', 'The response could not be understood.')
    }

    if (decoded.kind === 'success') return decoded.data as TData

    if (decoded.kind === 'unauthorized') {
      const error = new ClientRequestError(
        'unauthorized',
        safeErrorCode(decoded.code, defaultUnauthorizedCode),
        safeMessage(decoded.message, genericUnauthorizedMessage),
      )
      await invokeUnauthorized(error)
      throw error
    }

    const error = new ClientRequestError(
      'business',
      safeErrorCode(decoded.code, defaultBusinessCode),
      safeMessage(decoded.message, genericBusinessMessage),
    )
    try {
      await options.hooks?.businessError?.(error)
    } catch {
      // Hook failures remain attached to this stable business failure path.
    }
    throw error
  }

  return { request }
}

export type ClientResult<TData = unknown> = ClientDecodeResult<TData>
export type ClientRequestResult<TData = unknown> = Promise<TData>
export type ClientHook = (error: ClientRequestError) => void | Promise<void>
