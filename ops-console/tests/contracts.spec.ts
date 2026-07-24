import { describe, expect, it } from 'vitest'
import { parseMaintenance, parseOpsStatus, parseOpsTask, parseRuntimeLogs } from '../src/contracts'
import { envelope, maintenanceData, statusData, taskData } from './fixtures'

describe('ops-console contracts', () => {
  it('parses exact status, task, maintenance, and structured event shapes', () => {
    expect(parseOpsStatus(envelope(statusData)).migrations.pending).toBe(2)
    expect(parseOpsTask(envelope(taskData)).taskType).toBe('ops.backup.create')
    expect(parseMaintenance(envelope(maintenanceData))?.reasonKey).toBe('upgrade')
    expect(parseRuntimeLogs(envelope({ items: [{ event_key: 'runtime.request.failed', severity: 'error', component_key: 'http.runtime', message: 'A runtime request failed.', occurred_at: '2026-07-24T02:00:00.000Z', request_id: 'req_1', occurrences: 2 }], next_cursor: 'cursor_12345678' })).items[0]?.message).toBe('A runtime request failed.')
  })

  it('rejects extra execution fields, inconsistent state, raw evidence, and unknown envelopes', () => {
    expect(() => parseOpsTask(envelope({ ...taskData, handler_key: 'ops.backup.private' }))).toThrow('OPS_RESPONSE_INVALID')
    expect(() => parseOpsTask(envelope({ ...taskData, status: 'succeeded' }))).toThrow('OPS_RESPONSE_INVALID')
    expect(() => parseOpsStatus({ ...envelope(statusData) as object, debug: true })).toThrow('OPS_RESPONSE_INVALID')
    for (const message of ['password=secret', 'mysql://root:secret@host/db', 'SELECT * FROM users', '/private/runtime/error.log', 'Stack trace #0']) {
      expect(() => parseRuntimeLogs(envelope({ items: [{ event_key: 'runtime.failed', severity: 'error', component_key: 'http.runtime', message, occurred_at: '2026-07-24T02:00:00.000Z', request_id: null, occurrences: 1 }], next_cursor: null }))).toThrow('OPS_RESPONSE_INVALID')
    }
  })
})
