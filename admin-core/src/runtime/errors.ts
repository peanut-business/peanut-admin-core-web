import type { ApiAudience } from '../api/client'
import type { ProblemDetails } from '../api/problem'

export type AdminRuntimeErrorKind =
  | 'login'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'unavailable'
  | 'configuration'

export interface AdminRuntimeErrorState {
  kind: AdminRuntimeErrorKind
  audience: ApiAudience
  code: string
  requestId: string | null
  retryAfter: string | null
}

interface ProblemErrorSource {
  problem: ProblemDetails
  retryAfter?: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const problemSource = (value: unknown): ProblemErrorSource | null => {
  if (!isRecord(value) || !isRecord(value.problem)) return null
  const problem = value.problem
  if (typeof problem.status !== 'number'
    || typeof problem.code !== 'string'
    || typeof problem.request_id !== 'string') return null

  return {
    problem: problem as unknown as ProblemDetails,
    retryAfter: typeof value.retryAfter === 'string' ? value.retryAfter : null,
  }
}

const kindForStatus = (status: number): AdminRuntimeErrorKind => {
  if (status === 401) return 'login'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409 || status === 412) return 'conflict'
  if (status === 429) return 'rate-limited'
  return 'unavailable'
}

export const mapAdminRuntimeError = (
  error: unknown,
  audience: ApiAudience,
): AdminRuntimeErrorState => {
  const source = problemSource(error)
  if (source !== null) {
    return {
      kind: kindForStatus(source.problem.status),
      audience,
      code: source.problem.code,
      requestId: source.problem.request_id,
      retryAfter: source.retryAfter ?? null,
    }
  }

  const code = error instanceof Error ? error.message : 'CLIENT_BOOT_FAILED'
  if (code === 'API_ORIGIN_INVALID'
    || code === 'API_ORIGIN_MISMATCH'
    || code.startsWith('API_AUDIENCE_MISMATCH')) {
    return { kind: 'configuration', audience, code, requestId: null, retryAfter: null }
  }

  return {
    kind: 'unavailable',
    audience,
    code: code === '' ? 'CLIENT_BOOT_FAILED' : code,
    requestId: null,
    retryAfter: null,
  }
}
