import { describe, expect, it } from 'vitest'

import { ADMIN_SHELL_PACKAGE, ADMIN_SHELL_VERSION, SHELL_THEME_TOKENS } from '../src/index'

describe('@peanut-admin/admin-shell', () => {
  it('exposes a stable package identity', () => {
    expect(ADMIN_SHELL_PACKAGE).toBe('@peanut-admin/admin-shell')
    expect(ADMIN_SHELL_VERSION).toBe('0.1.0')
    expect(SHELL_THEME_TOKENS.headerHeight).toBe('--pa-shell-header-height')
  })
})
