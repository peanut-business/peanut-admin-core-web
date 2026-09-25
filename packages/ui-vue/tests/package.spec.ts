import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

import {
  PEANUT_ADMIN_UI_VUE_PACKAGE,
  PEANUT_ADMIN_UI_VUE_VERSION,
  defineShellHostConfig,
  SHELL_THEME_TOKENS,
} from '../src/index';

const validConfig = {
  brand: { name: ' Peanut Admin ', mark: ' P ' },
  audiences: {
    tenant: { label: ' Tenant workspace ' },
    platform: { label: ' Platform control ' },
  },
  commands: {
    switchTenantLabel: ' Switch tenant ',
    logoutLabel: ' Log out ',
  },
};

describe('@peanut-admin/ui-vue', () => {
  it('exposes a stable package identity', () => {
    expect(PEANUT_ADMIN_UI_VUE_PACKAGE).toBe('@peanut-admin/ui-vue');
    expect(PEANUT_ADMIN_UI_VUE_VERSION).toBe(manifest.version);
    expect(SHELL_THEME_TOKENS.headerHeight).toBe('--pa-shell-header-height');
  });

  it('validates, trims, and freezes presentation-only host configuration', () => {
    const config = defineShellHostConfig(validConfig);

    expect(config).toEqual({
      brand: { name: 'Peanut Admin', mark: 'P' },
      audiences: {
        tenant: { label: 'Tenant workspace' },
        platform: { label: 'Platform control' },
      },
      commands: {
        switchTenantLabel: 'Switch tenant',
        logoutLabel: 'Log out',
      },
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.brand)).toBe(true);
    expect(Object.isFrozen(config.audiences)).toBe(true);
  });

  it('rejects empty, oversized, and non-presentation configuration', () => {
    expect(() =>
      defineShellHostConfig({
        ...validConfig,
        brand: { ...validConfig.brand, name: '   ' },
      })
    ).toThrow('SHELL_CONFIG_INVALID:brand.name');
    expect(() =>
      defineShellHostConfig({
        ...validConfig,
        brand: { ...validConfig.brand, mark: 'x'.repeat(13) },
      })
    ).toThrow('SHELL_CONFIG_INVALID:brand.mark');
    expect(() =>
      defineShellHostConfig({
        ...validConfig,
        tenantId: 'tenant-private',
      } as unknown as Parameters<typeof defineShellHostConfig>[0])
    ).toThrow('SHELL_CONFIG_UNKNOWN_FIELD:tenantId');
    expect(() =>
      defineShellHostConfig({
        ...validConfig,
        brand: { ...validConfig.brand, token: 'private-token' },
      } as unknown as Parameters<typeof defineShellHostConfig>[0])
    ).toThrow('SHELL_CONFIG_UNKNOWN_FIELD:brand.token');
  });
});
