import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

import {
  PEANUT_ADMIN_VUE_PACKAGE,
  PEANUT_ADMIN_VUE_VERSION,
} from '../src/index';

describe('@peanut-admin/vue', () => {
  it('exposes a stable package identity', () => {
    expect(PEANUT_ADMIN_VUE_PACKAGE).toBe('@peanut-admin/vue');
    expect(PEANUT_ADMIN_VUE_VERSION).toBe(manifest.version);
  });
});
