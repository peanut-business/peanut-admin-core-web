import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

import { WEB_TESTING_PACKAGE, WEB_TESTING_VERSION } from '../src/index'

describe('@peanut-admin/testing', () => {
  it('exposes a stable package identity', () => {
    expect(WEB_TESTING_PACKAGE).toBe('@peanut-admin/testing')
    expect(WEB_TESTING_VERSION).toBe(manifest.version)
  })
})
