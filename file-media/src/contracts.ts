export type FileStatus = 'ready' | 'archived'

export interface FileObject {
  readonly fileKey: string
  readonly originalName: string
  readonly mediaType: string
  readonly sizeBytes: number
  readonly sha256: string
  readonly status: FileStatus
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly archivedAt: string | null
}

export interface FileList {
  readonly items: readonly FileObject[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
}

export interface FileTransportResult {
  readonly body: unknown
  readonly headers: Headers
  readonly status: number
}

export interface FileMediaTransport {
  list: (status: FileStatus, page: number, pageSize: number, signal: AbortSignal) => Promise<FileTransportResult>
  assets: (page: number, pageSize: number, signal: AbortSignal) => Promise<FileTransportResult>
  upload: (file: File, signal: AbortSignal) => Promise<FileTransportResult>
  download: (fileKey: string, signal: AbortSignal) => Promise<Response>
  archive: (fileKey: string, etag: string, signal: AbortSignal) => Promise<FileTransportResult>
}

export interface ImageVariant {
  readonly variantKey: string
  readonly width: number
  readonly height: number
  readonly mediaType: 'image/jpeg' | 'image/png'
  readonly deliveryUri: string | null
}

export interface AssetCandidate {
  readonly fileKey: string
  readonly originalName: string
  readonly mediaType: 'image/jpeg' | 'image/png'
  readonly width: number
  readonly height: number
  readonly previewUri: string | null
  readonly variants: readonly ImageVariant[]
}

export interface AssetList {
  readonly items: readonly AssetCandidate[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
}

const fileKeyPattern = /^file_[0-9a-f]{32}$/
const shaPattern = /^[0-9a-f]{64}$/

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('FILE_MEDIA_RESPONSE_INVALID')
  return value as Record<string, unknown>
}

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): void => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('FILE_MEDIA_RESPONSE_INVALID')
  }
}

const deliveryUri = (value: unknown): string | null => {
  if (value === null) return null
  if (typeof value !== 'string' || value === '' || value.length > 2048 || value.includes('#')) {
    throw new Error('FILE_MEDIA_RESPONSE_INVALID')
  }
  if (value.startsWith('/')) {
    if (value.startsWith('//') || !value.startsWith('/api/')) throw new Error('FILE_MEDIA_RESPONSE_INVALID')
    return value
  }
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new Error('FILE_MEDIA_RESPONSE_INVALID') }
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
    throw new Error('FILE_MEDIA_RESPONSE_INVALID')
  }
  return value
}

export const parseFileObject = (value: unknown): FileObject => {
  const item = record(value)
  exactKeys(item, [
    'file_key', 'original_name', 'media_type', 'size_bytes', 'sha256', 'status',
    'revision', 'created_at', 'updated_at', 'archived_at',
  ])
  if (
    typeof item.file_key !== 'string' || !fileKeyPattern.test(item.file_key)
    || typeof item.original_name !== 'string' || item.original_name === '' || [...item.original_name].length > 255
    || typeof item.media_type !== 'string' || item.media_type === '' || item.media_type.length > 127
    || typeof item.size_bytes !== 'number' || !Number.isSafeInteger(item.size_bytes) || item.size_bytes < 1
    || typeof item.sha256 !== 'string' || !shaPattern.test(item.sha256)
    || (item.status !== 'ready' && item.status !== 'archived')
    || typeof item.revision !== 'number' || !Number.isSafeInteger(item.revision) || item.revision < 1
    || typeof item.created_at !== 'string' || !Number.isFinite(Date.parse(item.created_at))
    || typeof item.updated_at !== 'string' || !Number.isFinite(Date.parse(item.updated_at))
    || (item.archived_at !== null && (typeof item.archived_at !== 'string' || !Number.isFinite(Date.parse(item.archived_at))))
    || (item.status === 'ready') !== (item.archived_at === null)
  ) throw new Error('FILE_MEDIA_RESPONSE_INVALID')

  return {
    fileKey: item.file_key,
    originalName: item.original_name,
    mediaType: item.media_type,
    sizeBytes: item.size_bytes,
    sha256: item.sha256,
    status: item.status,
    revision: item.revision,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    archivedAt: item.archived_at,
  }
}

export const parseFileResponse = (value: unknown): FileObject => {
  const body = record(value)
  exactKeys(body, ['data', 'meta'])
  record(body.meta)
  return parseFileObject(body.data)
}

export const parseFileList = (value: unknown): FileList => {
  const body = record(value)
  exactKeys(body, ['data', 'meta'])
  const data = record(body.data)
  exactKeys(data, ['items'])
  const meta = record(body.meta)
  if (!Array.isArray(data.items)) throw new Error('FILE_MEDIA_RESPONSE_INVALID')
  for (const key of ['page', 'page_size', 'total'] as const) {
    if (typeof meta[key] !== 'number' || !Number.isSafeInteger(meta[key]) || meta[key] < (key === 'total' ? 0 : 1)) {
      throw new Error('FILE_MEDIA_RESPONSE_INVALID')
    }
  }
  return {
    items: data.items.map(parseFileObject),
    page: meta.page as number,
    pageSize: meta.page_size as number,
    total: meta.total as number,
  }
}

export const parseAssetCandidate = (value: unknown): AssetCandidate => {
  const item = record(value)
  exactKeys(item, ['file_key', 'original_name', 'media_type', 'width', 'height', 'preview_uri', 'variants'])
  if (
    typeof item.file_key !== 'string' || !fileKeyPattern.test(item.file_key)
    || typeof item.original_name !== 'string' || item.original_name === '' || [...item.original_name].length > 255
    || (item.media_type !== 'image/jpeg' && item.media_type !== 'image/png')
    || typeof item.width !== 'number' || !Number.isSafeInteger(item.width) || item.width < 1 || item.width > 50000
    || typeof item.height !== 'number' || !Number.isSafeInteger(item.height) || item.height < 1 || item.height > 50000
    || item.width * item.height > 100_000_000
    || !Array.isArray(item.variants) || item.variants.length > 16
  ) throw new Error('FILE_MEDIA_RESPONSE_INVALID')
  const keys = new Set<string>()
  const variants = item.variants.map((value): ImageVariant => {
    const variant = record(value)
    exactKeys(variant, ['variant_key', 'width', 'height', 'media_type', 'delivery_uri'])
    if (
      typeof variant.variant_key !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(variant.variant_key)
      || keys.has(variant.variant_key)
      || typeof variant.width !== 'number' || !Number.isSafeInteger(variant.width) || variant.width < 1 || variant.width > 4096
      || typeof variant.height !== 'number' || !Number.isSafeInteger(variant.height) || variant.height < 1 || variant.height > 4096
      || (variant.media_type !== 'image/jpeg' && variant.media_type !== 'image/png')
    ) throw new Error('FILE_MEDIA_RESPONSE_INVALID')
    keys.add(variant.variant_key)
    return {
      variantKey: variant.variant_key,
      width: variant.width,
      height: variant.height,
      mediaType: variant.media_type,
      deliveryUri: deliveryUri(variant.delivery_uri),
    }
  })
  return {
    fileKey: item.file_key,
    originalName: item.original_name,
    mediaType: item.media_type,
    width: item.width,
    height: item.height,
    previewUri: deliveryUri(item.preview_uri),
    variants,
  }
}

export const parseAssetList = (value: unknown): AssetList => {
  const body = record(value)
  exactKeys(body, ['data', 'meta'])
  const data = record(body.data)
  const meta = record(body.meta)
  exactKeys(data, ['items'])
  exactKeys(meta, ['request_id', 'page', 'page_size', 'total'])
  if (!Array.isArray(data.items) || typeof meta.request_id !== 'string' || meta.request_id === '') {
    throw new Error('FILE_MEDIA_RESPONSE_INVALID')
  }
  for (const key of ['page', 'page_size', 'total'] as const) {
    if (typeof meta[key] !== 'number' || !Number.isSafeInteger(meta[key]) || meta[key] < (key === 'total' ? 0 : 1)) {
      throw new Error('FILE_MEDIA_RESPONSE_INVALID')
    }
  }
  return {
    items: data.items.map(parseAssetCandidate),
    page: meta.page as number,
    pageSize: meta.page_size as number,
    total: meta.total as number,
  }
}
