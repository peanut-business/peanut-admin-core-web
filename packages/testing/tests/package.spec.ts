import { describe, expect, it } from 'vitest'

import { WEB_TESTING_PACKAGE, WEB_TESTING_VERSION } from '../src/index'

describe('@peanut-admin/testing', () => {
  it('exposes a stable package identity', () => {
    expect(WEB_TESTING_PACKAGE).toBe('@peanut-admin/testing')
    expect(WEB_TESTING_VERSION).toBe('4.0.0-dev.0')
  })
})
