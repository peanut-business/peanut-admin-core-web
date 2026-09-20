import { describe, expect, it } from 'vitest'

import { PEANUT_ADMIN_VUE_PACKAGE, PEANUT_ADMIN_VUE_VERSION } from '../src/index'

describe('@peanut-admin/vue', () => {
  it('exposes a stable package identity', () => {
    expect(PEANUT_ADMIN_VUE_PACKAGE).toBe('@peanut-admin/vue')
    expect(PEANUT_ADMIN_VUE_VERSION).toBe('4.0.0-dev.0')
  })
})
