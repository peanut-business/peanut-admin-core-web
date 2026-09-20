import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import {
  createMenuRouteRegistry,
  defineAdminModule,
  disposeTenantState,
  registerTenantDisposer,
  useOperationTargets,
} from '../src/index'

const projectRoute = () => defineAdminModule({
  key: 'example.work-item',
  routes: [{
    name: 'example.work-item.list',
    path: '/app/work-items',
    component: async () => ({ default: {} }),
    access: { moduleKey: 'example.work-item', permissionKeys: ['example.work-item.read'] },
  }],
  disposeOnTenantChange: true,
})

describe('module and operation target state', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('resolves only build-time registered menu route names', () => {
    const registry = createMenuRouteRegistry([projectRoute()])

    expect(registry.resolve('example.work-item.list')?.path).toBe('/app/work-items')
    expect(registry.resolve('server.provided.component')).toBeNull()
    expect(registry.diagnostics()).toEqual(['server.provided.component'])
  })

  it('uses the same module key grammar as the backend runtime', () => {
    expect(defineAdminModule({ key: 'core', routes: [], disposeOnTenantChange: true }).key).toBe('core')
    expect(() => defineAdminModule({ key: 'Bad_Key', routes: [], disposeOnTenantChange: true })).toThrow('ADMIN_MODULE_KEY_INVALID')
  })

  it('keeps same-looking IDs separate by operation and target type', () => {
    const targets = useOperationTargets()
    const projectScope = {
      moduleKey: 'example.work-item',
      resourceKey: 'example.work-item',
      operation: 'list',
      targetResourceKey: 'example.project',
      targetRole: 'primary',
    } as const
    const queueScope = { ...projectScope, targetResourceKey: 'example.queue' }

    targets.replace(projectScope, [{ target_resource_key: 'example.project', target_role: 'primary', target_id: '9001', label: 'Project' }])
    targets.replace(queueScope, [{ target_resource_key: 'example.queue', target_role: 'primary', target_id: '9001', label: 'Queue' }])

    expect(targets.selected(projectScope)).toEqual([{ target_resource_key: 'example.project', target_role: 'primary', target_id: '9001' }])
    expect(targets.selected(queueScope)).toEqual([{ target_resource_key: 'example.queue', target_role: 'primary', target_id: '9001' }])
  })

  it('rejects multiple primary targets for a one-required operation', () => {
    const targets = useOperationTargets()
    const scope = {
      moduleKey: 'example.work-item',
      resourceKey: 'example.work-item',
      operation: 'update',
      targetResourceKey: 'example.project',
      targetRole: 'primary',
      cardinality: 'one_required',
    } as const
    targets.replace(scope, [
      { target_resource_key: 'example.project', target_role: 'primary', target_id: '9001', label: 'One' },
      { target_resource_key: 'example.project', target_role: 'primary', target_id: '9002', label: 'Two' },
    ])

    expect(() => targets.select(scope, [
      { target_resource_key: 'example.project', target_role: 'primary', target_id: '9001' },
      { target_resource_key: 'example.project', target_role: 'primary', target_id: '9002' },
    ])).toThrow('TARGET_SELECTION_CARDINALITY_INVALID')
    expect(() => targets.selectionForRequest(scope)).toThrow('TARGET_SELECTION_CARDINALITY_INVALID')
  })

  it('disposes registered tenant state once during a switch', async () => {
    const dispose = vi.fn()
    const unregister = registerTenantDisposer('example.work-item', dispose)

    await disposeTenantState()
    unregister()
    await disposeTenantState()

    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes every registered store even when one disposer fails', async () => {
    const first = vi.fn(async () => { throw new Error('STORE_DISPOSAL_FAILED') })
    const second = vi.fn()
    const unregisterFirst = registerTenantDisposer('example.work-item.first', first)
    const unregisterSecond = registerTenantDisposer('example.work-item.second', second)

    await expect(disposeTenantState()).rejects.toThrow('STORE_DISPOSAL_FAILED')
    unregisterFirst()
    unregisterSecond()

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })
})
