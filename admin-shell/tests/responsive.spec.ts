// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import {
  ConflictState,
  EmptyState,
  ForbiddenState,
  ModuleUnavailableState,
  NotFoundState,
  RateLimitState,
  ServiceUnavailableState,
  SessionExpiredState,
} from '../src/index'

describe('admin shell status and responsive contracts', () => {
  it('keeps denial, absence, conflict, availability, session, and empty states distinct', () => {
    const states = [
      [ForbiddenState, 'forbidden'],
      [NotFoundState, 'not-found'],
      [ModuleUnavailableState, 'module-unavailable'],
      [ConflictState, 'conflict'],
      [ServiceUnavailableState, 'service-unavailable'],
      [SessionExpiredState, 'session-expired'],
      [EmptyState, 'empty'],
    ] as const

    for (const [component, state] of states) {
      expect(mount(component).attributes('data-state')).toBe(state)
    }
  })

  it('renders Retry-After without starting an automatic retry loop', () => {
    vi.useFakeTimers()
    const wrapper = mount(RateLimitState, {
      props: { retryAfter: '120', requestId: 'req_rate_limit' },
    })

    expect(wrapper.attributes('data-state')).toBe('rate-limit')
    expect(wrapper.text()).toContain('120')
    expect(wrapper.text()).toContain('req_rate_limit')
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })

  it('runs status actions only after an explicit user command', async () => {
    const action = vi.fn()
    const wrapper = mount(ServiceUnavailableState, {
      props: { requestId: 'req_service', onAction: action },
    })

    expect(action).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    expect(action).toHaveBeenCalledOnce()
  })
})
