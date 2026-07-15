import { describe, expect, it } from 'vitest'

import { WEB_TESTING_PACKAGE, WEB_TESTING_VERSION } from '../src/index'

describe('@peanut-admin/web-testing', () => {
  it('exposes a stable package identity', () => {
    expect(WEB_TESTING_PACKAGE).toBe('@peanut-admin/web-testing')
    expect(WEB_TESTING_VERSION).toBe('0.1.0')
  })
})
