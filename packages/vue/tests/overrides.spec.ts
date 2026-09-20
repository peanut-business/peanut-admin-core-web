import { describe, expect, it } from 'vitest'

import {
  createAdminOverrideRegistry,
  defineAdminOverrideSlot,
} from '../src/index'

const headerSlot = (overrides: Record<string, unknown> = {}) => ({
  key: 'peanut.shell.component.header',
  kind: 'component' as const,
  contractVersion: '1.0.0',
  defaultValue: 'package-header',
  validate: (value: unknown): value is string => typeof value === 'string',
  ...overrides,
})

describe('Admin Web override registry', () => {
  it('resolves package defaults and application replacements with immutable source metadata', () => {
    const defaults = createAdminOverrideRegistry({ slots: [headerSlot()] })
    expect(defaults.resolve('peanut.shell.component.header')).toEqual({
      key: 'peanut.shell.component.header',
      kind: 'component',
      contractVersion: '1.0.0',
      value: 'package-header',
      source: 'default',
    })
    expect(defaults.get('peanut.shell.component.header')).toBe('package-header')

    const application = createAdminOverrideRegistry({
      slots: [defineAdminOverrideSlot(headerSlot())],
      overrides: [{
        key: 'peanut.shell.component.header',
        kind: 'component',
        contractVersion: '1.0.0',
        value: 'application-header',
      }],
    })
    expect(application.resolve('peanut.shell.component.header')).toEqual({
      key: 'peanut.shell.component.header',
      kind: 'component',
      contractVersion: '1.0.0',
      value: 'application-header',
      source: 'application',
    })

    const metadata = application.diagnostics()
    expect(metadata).toEqual([{
      key: 'peanut.shell.component.header',
      kind: 'component',
      contractVersion: '1.0.0',
      source: 'application',
    }])
    expect(Object.isFrozen(metadata)).toBe(true)
    expect(Object.isFrozen(metadata[0])).toBe(true)
    expect(metadata).not.toBe(application.diagnostics())
    expect(application.resolve('peanut.shell.component.header').source).toBe('application')
  })

  it('rejects invalid and duplicate slot keys', () => {
    expect(() => createAdminOverrideRegistry({
      slots: [headerSlot({ key: 'Peanut.shell.component.header' })],
    })).toThrow('ADMIN_OVERRIDE_SLOT_KEY_INVALID')

    expect(() => createAdminOverrideRegistry({
      slots: [headerSlot(), headerSlot()],
    })).toThrow('ADMIN_OVERRIDE_SLOT_KEY_DUPLICATE')
  })

  it('rejects unknown and duplicate application overrides', () => {
    expect(() => createAdminOverrideRegistry({
      slots: [headerSlot()],
      overrides: [{
        key: 'peanut.shell.component.missing',
        kind: 'component',
        contractVersion: '1.0.0',
        value: 'application-header',
      }],
    })).toThrow('ADMIN_OVERRIDE_KEY_UNKNOWN')

    const override = {
      key: 'peanut.shell.component.header',
      kind: 'component' as const,
      contractVersion: '1.0.0',
      value: 'application-header',
    }
    expect(() => createAdminOverrideRegistry({
      slots: [headerSlot()],
      overrides: [override, override],
    })).toThrow('ADMIN_OVERRIDE_KEY_DUPLICATE')
  })

  it('rejects kind and exact contract-version mismatches', () => {
    expect(() => createAdminOverrideRegistry({
      slots: [headerSlot()],
      overrides: [{
        key: 'peanut.shell.component.header',
        kind: 'service',
        contractVersion: '1.0.0',
        value: 'application-header',
      }],
    })).toThrow('ADMIN_OVERRIDE_KIND_MISMATCH')

    expect(() => createAdminOverrideRegistry({
      slots: [headerSlot()],
      overrides: [{
        key: 'peanut.shell.component.header',
        kind: 'component',
        contractVersion: '1.0.1',
        value: 'application-header',
      }],
    })).toThrow('ADMIN_OVERRIDE_CONTRACT_VERSION_MISMATCH')
  })

  it('rejects defaults and replacements rejected by the slot validator', () => {
    expect(() => createAdminOverrideRegistry({
      slots: [headerSlot({ defaultValue: 42 })],
    })).toThrow('ADMIN_OVERRIDE_DEFAULT_INVALID')

    expect(() => createAdminOverrideRegistry({
      slots: [headerSlot()],
      overrides: [{
        key: 'peanut.shell.component.header',
        kind: 'component',
        contractVersion: '1.0.0',
        value: 42,
      }],
    })).toThrow('ADMIN_OVERRIDE_VALUE_INVALID')
  })

  it('fails closed for an undeclared resolution', () => {
    const registry = createAdminOverrideRegistry({ slots: [headerSlot()] })
    expect(() => registry.resolve('peanut.shell.component.missing')).toThrow('ADMIN_OVERRIDE_SLOT_UNKNOWN')
  })
})
