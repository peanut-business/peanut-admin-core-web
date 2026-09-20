export interface ProblemFieldError {
  pointer: string
  code: string
  message: string
}

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  code: string
  request_id: string
  instance?: string
  errors?: readonly ProblemFieldError[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isFieldError = (value: unknown): value is ProblemFieldError => (
  isRecord(value)
  && typeof value.pointer === 'string'
  && typeof value.code === 'string'
  && typeof value.message === 'string'
)

export const parseProblemDetails = (value: unknown): ProblemDetails | null => {
  if (!isRecord(value)
    || typeof value.type !== 'string'
    || typeof value.title !== 'string'
    || typeof value.status !== 'number'
    || !Number.isInteger(value.status)
    || value.status < 400
    || value.status > 599
    || typeof value.detail !== 'string'
    || typeof value.code !== 'string'
    || typeof value.request_id !== 'string') {
    return null
  }

  if (value.errors !== undefined && (!Array.isArray(value.errors) || !value.errors.every(isFieldError))) {
    return null
  }

  const problem: ProblemDetails = {
    type: value.type,
    title: value.title,
    status: value.status,
    detail: value.detail,
    code: value.code,
    request_id: value.request_id,
  }
  if (typeof value.instance === 'string') {
    problem.instance = value.instance
  }
  if (Array.isArray(value.errors)) {
    problem.errors = value.errors
  }

  return problem
}

export const isProblemCode = (problem: ProblemDetails | null, code: string): boolean => (
  problem?.code === code
)
