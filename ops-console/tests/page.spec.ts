// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide } from 'vue'
import OpsConsolePage from '../src/OpsConsolePage.vue'
import { LOG_SEVERITIES } from '../src/contracts'
import { createOpsConsoleRuntime, opsConsoleRuntimeKey } from '../src/runtime'
import { envelope, maintenanceData, result, statusData } from './fixtures'

describe('ops-console page', () => {
  it('shows operational evidence while keeping ungranted actions disabled', async () => {
    const runtime = createOpsConsoleRuntime({
      transport: { overview: async () => result(200, envelope(statusData)), maintenance: async () => result(200, envelope(maintenanceData)), logs: async () => result(200, envelope({ items: [], next_cursor: null })), submitBackup: async () => { throw new Error('not called') }, submitRestore: async () => { throw new Error('not called') }, task: async () => { throw new Error('not called') }, scheduleMaintenance: async () => { throw new Error('not called') }, closeMaintenance: async () => { throw new Error('not called') } },
      providers: [{ key: 'reference.mysql', backup: true, restoreTargets: ['verification'] }], maintenanceReasons: ['upgrade'], logSources: ['application'],
      canRead: () => true, canBackup: () => false, canRestore: () => false, canMaintain: () => false, canReadLogs: () => true,
    })
    const host = defineComponent({ setup() { provide(opsConsoleRuntimeKey, runtime); return () => h(OpsConsolePage) } })
    const passthrough = { template: '<div><slot /><slot name="actions" /></div>' }
    const wrapper = mount(host, { global: { stubs: { PageContent: passthrough, PageHeader: passthrough, ElTabs: passthrough, ElTabPane: passthrough, EmptyState: true, ForbiddenState: { props: ['message'], template: '<div>{{ message }}</div>' }, ModuleUnavailableState: true, SessionExpiredState: true, ElSelect: passthrough, ElOption: true, ElInput: true, ElDatePicker: true, ElButton: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' } } } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('UPGRADE_PREFLIGHT_READY'))
    expect(wrapper.text()).toContain('UPGRADE_PREFLIGHT_READY')
    expect(wrapper.find('select[aria-label="Severity"]').findAll('option').map(option => option.text())).toEqual([...LOG_SEVERITIES])
    expect(wrapper.findAll('button').find(button => button.text() === 'Create backup')?.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').find(button => button.text() === 'Restore and verify')?.attributes('disabled')).toBeDefined()
  })
})
