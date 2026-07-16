// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  AdminShell,
  ForbiddenState,
  PageContent,
  PlatformShell,
  TargetScopeSummary,
} from '../src/index'

describe('admin shell components', () => {
  it('renders tenant and platform workspaces with separate audience markers', () => {
    expect(mount(AdminShell, { slots: { default: 'Tenant content' } }).attributes('data-audience')).toBe('tenant')
    expect(mount(PlatformShell, { slots: { default: 'Platform content' } }).attributes('data-audience')).toBe('platform')
  })

  it('keeps state and content components accessible', () => {
    const forbidden = mount(ForbiddenState, { props: { requestId: 'req_test_3' } })
    const content = mount(PageContent, { slots: { default: '<button>Command</button>' } })

    expect(forbidden.attributes('role')).toBe('status')
    expect(forbidden.text()).toContain('req_test_3')
    expect(content.find('button').exists()).toBe(true)
  })

  it('summarizes multiple targets without exposing raw identifiers', () => {
    const summary = mount(TargetScopeSummary, {
      props: { mode: 'multiple', availableCount: 5, selectedCount: 2, digest: 'private-digest' },
    })

    expect(summary.text()).toContain('2')
    expect(summary.text()).not.toContain('private-digest')
  })
})
