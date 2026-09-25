import { resolveClientUrl } from '@peanut-admin/client';
import type {
  ClientHeaders,
  ClientTransport,
  ClientTransportRequest,
} from '@peanut-admin/client';

export interface NuxtClientFetchOptions {
  readonly method?: string;
  readonly query?: unknown;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

export type NuxtClientFetch = (
  url: string,
  options?: NuxtClientFetchOptions
) => Promise<unknown>;

export interface NuxtClientTransportOptions {
  readonly baseUrl: string;
  readonly $fetch: NuxtClientFetch;
  /** Trusted server-only headers added after request headers are normalized. */
  readonly forwardHeaders?: Readonly<Record<string, string>>;
}

export interface NuxtSsrForwardHeadersOptions {
  /** Direct Host header received from the trusted ingress, never X-Forwarded-Host. */
  readonly requestHost: string;
  /** Original same-site cookie header; omitted rather than synthesized when absent. */
  readonly cookie?: string;
  /** Fixed deployment scheme. Do not derive this from an untrusted request header. */
  readonly forwardedProto: 'http' | 'https';
  /** Exact hosts or leading-wildcard domains. Empty means the ingress owns the allowlist. */
  readonly trustedHosts?: readonly string[];
}

const isQueryMethod = (method: string): boolean =>
  method === 'GET' || method === 'DELETE';

const headersRecord = (headers: ClientHeaders): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const invalidForwardContext = (): Error =>
  new Error('NUXT_SSR_FORWARD_CONTEXT_INVALID');

const normalizedHost = (value: string): { host: string; hostname: string } => {
  if (
    typeof value !== 'string' ||
    value === '' ||
    value.trim() !== value ||
    /[\u0000-\u0020\u007f]/u.test(value) ||
    /[\\/@]/u.test(value)
  )
    throw invalidForwardContext();

  let parsed: URL;
  try {
    parsed = new URL(`http://${value}`);
  } catch {
    throw invalidForwardContext();
  }
  if (
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.hostname === ''
  )
    throw invalidForwardContext();

  return {
    host: parsed.host.toLowerCase(),
    hostname: parsed.hostname.toLowerCase(),
  };
};

const trustedHost = (
  request: { host: string; hostname: string },
  patterns: readonly string[]
): boolean =>
  patterns.length === 0 ||
  patterns.some((rawPattern) => {
    const pattern = rawPattern.trim().toLowerCase();
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      return (
        suffix.length > 1 &&
        request.hostname.endsWith(suffix) &&
        request.hostname.length > suffix.length
      );
    }
    try {
      const expected = normalizedHost(pattern);
      return pattern.includes(':')
        ? request.host === expected.host
        : request.hostname === expected.hostname;
    } catch {
      return false;
    }
  });

/**
 * Build the only request-derived headers allowed across the Nuxt SSR bridge.
 * The upstream URL remains deployment configuration and is never read from
 * Host, forwarded headers, query strings, or cookies.
 */
export const createNuxtSsrForwardHeaders = (
  options: NuxtSsrForwardHeadersOptions
): Readonly<Record<string, string>> => {
  const request = normalizedHost(options.requestHost);
  if (!trustedHost(request, options.trustedHosts ?? []))
    throw invalidForwardContext();
  if (options.cookie !== undefined && /[\u0000\r\n]/u.test(options.cookie)) {
    throw invalidForwardContext();
  }

  return {
    'host': request.host,
    'x-forwarded-host': request.host,
    'x-forwarded-proto': options.forwardedProto,
    ...(options.cookie ? { cookie: options.cookie } : {}),
  };
};

export const createNuxtClientTransport = (
  options: NuxtClientTransportOptions
): ClientTransport => {
  return async (request: ClientTransportRequest): Promise<unknown> => {
    const method = request.method.toUpperCase();
    const url = resolveClientUrl(options.baseUrl, request.path);
    const fetchOptions: NuxtClientFetchOptions = {
      method,
      headers: {
        ...headersRecord(request.headers),
        ...options.forwardHeaders,
      },
      ...(request.data !== undefined
        ? isQueryMethod(method)
          ? { query: request.data }
          : { body: request.data }
        : {}),
    };
    return options.$fetch(url, fetchOptions);
  };
};
