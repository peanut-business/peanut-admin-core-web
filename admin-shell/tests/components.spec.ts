// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  AdminShell,
  defineShellHostConfig,
  ForbiddenState,
  PageContent,
  PlatformShell,
  TargetScopeSummary,
} from '../src/index'

const config = defineShellHostConfig({
  brand: { name: 'Host Admin', mark: 'H' },
  audiences: {
    tenant: { label: 'Tenant workspace' },
    platform: { label: 'Platform control' },
  },
  commands: {
    switchTenantLabel: 'Switch tenant',
    logoutLabel: 'Log out',
  },
})

const identity = {
  accountLabel: 'account@example.test',
  contextLabel: 'Alpha Tenant',
  actorLabel: 'Tenant Owner',
}

const navigation = [{
  key: 'home',
  label: 'Workspace',
  path: '/app',
  children: [],
}, {
  key: 'administration',
  label: 'Administration',
  path: null,
  children: [{
    key: 'members',
    label: 'Members',
    path: '/app/members',
    children: [],
  }],
}, {
  key: 'unsafe-external',
  label: 'Unsafe external route',
  path: '/\\evil.test',
  children: [],
}]

const tenantProps = {
  config,
  identity,
  navigation,
  breadcrumbs: [
    { label: 'Tenant workspace', path: '/app' },
    { label: 'Members', path: null },
  ],
  activePath: '/app/members',
  collapsed: false,
  mobileOpen: false,
}

describe('admin shell components', () => {
  it('renders tenant and platform workspaces with separate audience markers', () => {
    const tenant = mount(AdminShell, {
      attrs: { 'data-audience': 'platform' },
      props: tenantProps,
      slots: { default: 'Tenant content' },
    })
    const platform = mount(PlatformShell, {
      attrs: { 'data-audience': 'tenant' },
      props: {
        ...tenantProps,
        navigation: [{ key: 'platform-home', label: 'Platform', path: '/platform', children: [] }],
        breadcrumbs: [{ label: 'Platform control', path: null }],
        activePath: '/platform',
      },
      slots: { default: 'Platform content' },
    })

    expect(tenant.attributes('data-audience')).toBe('tenant')
    expect(platform.attributes('data-audience')).toBe('platform')
    expect(tenant.text()).toContain('Host Admin')
    expect(tenant.text()).toContain('Alpha Tenant')
    expect(tenant.text()).toContain('account@example.test')
    expect(tenant.get('[aria-current="page"]').text()).toContain('Members')
    expect(platform.text()).not.toContain('Switch tenant')
    expect(platform.emitted('switch-tenant')).toBeUndefined()
  })

  it('emits only host commands and trusted local navigation paths', async () => {
    const wrapper = mount(AdminShell, { props: tenantProps })

    await wrapper.get('.pa-shell-sidebar a[href="/app/members"]').trigger('click')
    await wrapper.get('.pa-shell__collapse').trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Switch tenant')?.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Log out')?.trigger('click')

    expect(wrapper.emitted('navigate')).toEqual([['/app/members']])
    expect(wrapper.emitted('update:collapsed')).toEqual([[true]])
    expect(wrapper.emitted('switch-tenant')).toHaveLength(1)
    expect(wrapper.emitted('logout')).toHaveLength(1)
    expect(wrapper.findAll('a').some(link => link.attributes('href') === '/\\evil.test')).toBe(false)
    expect(wrapper.get('.pa-shell-navigation__link[href="/app/members"]').attributes('aria-label')).toBe('Members')
    expect(wrapper.html()).not.toContain('component')
    expect(wrapper.html()).not.toContain('javascript:')
  })

  it('exposes accessible collapse, Drawer, identity, breadcrumb, and command controls', async () => {
    const wrapper = mount(AdminShell, {
      attachTo: document.body,
      props: tenantProps,
    })

    expect(wrapper.get('.pa-shell__collapse').attributes('aria-label')).toBe('Collapse navigation')
    expect(wrapper.get('.pa-shell-breadcrumb').attributes('aria-label')).toBe('Breadcrumb')
    expect(wrapper.get('.pa-shell-identity').attributes('aria-label')).toBe('Current identity')
    expect(wrapper.get('.mobile-nav-trigger').attributes('aria-expanded')).toBe('false')

    await wrapper.get('.mobile-nav-trigger').trigger('click')
    expect(wrapper.emitted('update:mobileOpen')).toContainEqual([true])
    await wrapper.setProps({ mobileOpen: true })
    expect(wrapper.get('.mobile-nav-trigger').attributes('aria-expanded')).toBe('true')
    expect(document.querySelector('.mobile-navigation-drawer .el-drawer__close-btn')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:mobileOpen')).toContainEqual([false])

    wrapper.unmount()
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
