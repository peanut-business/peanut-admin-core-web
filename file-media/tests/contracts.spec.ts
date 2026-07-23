import { describe, expect, it } from 'vitest'
import { parseFileList, parseFileObject } from '../src/contracts'

const file = {
  file_key: 'file_0123456789abcdef0123456789abcdef', original_name: 'report.txt', media_type: 'text/plain',
  size_bytes: 12, sha256: 'a'.repeat(64), status: 'ready', revision: 1,
  created_at: '2026-07-23T00:00:00.000Z', updated_at: '2026-07-23T00:00:00.000Z', archived_at: null,
}

describe('file-media contracts', () => {
  it('parses the exact public shape and list metadata', () => {
    expect(parseFileObject(file).fileKey).toBe(file.file_key)
    expect(parseFileList({ data: { items: [file] }, meta: { request_id: 'req_1', page: 1, page_size: 20, total: 1 } }).total).toBe(1)
  })

  it('rejects internal fields and inconsistent archive state', () => {
    expect(() => parseFileObject({ ...file, storage_key: 'private/path' })).toThrow('FILE_MEDIA_RESPONSE_INVALID')
    expect(() => parseFileObject({ ...file, status: 'archived' })).toThrow('FILE_MEDIA_RESPONSE_INVALID')
  })
})
