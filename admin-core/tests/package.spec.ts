import { describe, expect, it } from 'vitest'

import { ADMIN_CORE_PACKAGE, ADMIN_CORE_VERSION } from '../src/index'

describe('@peanut-admin/admin/core', () => {
  it('exposes a stable package identity', () => {
    expect(ADMIN_CORE_PACKAGE).toBe('@peanut-admin/admin/core')
    expect(ADMIN_CORE_VERSION).toBe('0.1.0')
  })
})
