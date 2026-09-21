import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useAsyncAction, useAsyncList } from '../src/index'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

describe('async list state', () => {
  it('keeps the newest page when an older request returns late', async () => {
    const first = deferred<{ items: string[]; total: number; page: number; pageSize: number }>()
    const second = deferred<{ items: string[]; total: number; page: number; pageSize: number }>()
    const load = vi.fn(({ page }: { page: number }) => page === 1 ? first.promise : second.promise)
    const scope = effectScope()
    const state = scope.run(() => useAsyncList({
      initialFilters: { name: '' },
      initialPageSize: 10,
      load,
      errorMessage: () => 'LOAD_FAILED',
    }))!

    const oldRequest = state.load(1)
    const newRequest = state.load(2)
    second.resolve({ items: ['new'], total: 1, page: 2, pageSize: 10 })
    await expect(newRequest).resolves.toBe(true)
    first.resolve({ items: ['old'], total: 1, page: 1, pageSize: 10 })
    await expect(oldRequest).resolves.toBe(false)

    expect(state.items.value).toEqual(['new'])
    expect(state.pagination.page).toBe(2)
    expect(state.loading.value).toBe(false)
    scope.stop()
  })

  it('clears data and rejects late writes after a Tenant context change', async () => {
    const pending = deferred<{ items: string[]; total: number; page: number; pageSize: number }>()
    const scope = effectScope()
    const state = scope.run(() => useAsyncList({
      initialFilters: {},
      initialPageSize: 20,
      load: () => pending.promise,
      errorMessage: () => 'LOAD_FAILED',
    }))!

    const request = state.load()
    state.clear()
    pending.resolve({ items: ['wrong-tenant'], total: 1, page: 1, pageSize: 20 })

    await expect(request).resolves.toBe(false)
    expect(state.items.value).toEqual([])
    expect(state.pagination.total).toBe(0)
    expect(state.error.value).toBeNull()
    scope.stop()
  })
})

describe('async action state', () => {
  it('exposes stable form errors and blocks duplicate submission', async () => {
    const pending = deferred<string>()
    const scope = effectScope()
    const state = scope.run(() => useAsyncAction(() => 'SUBMIT_FAILED'))!

    const first = state.run(() => pending.promise)
    await expect(state.run(async () => 'duplicate')).resolves.toEqual({ status: 'busy' })
    pending.reject(new Error('private upstream detail'))
    await expect(first).resolves.toEqual({ status: 'failed', error: 'SUBMIT_FAILED' })
    expect(state.error.value).toBe('SUBMIT_FAILED')
    expect(state.loading.value).toBe(false)
    scope.stop()
  })
})
