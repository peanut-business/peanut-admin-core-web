import { createAdminOverrideRegistry } from '@peanut-admin/vue';
import { expect, it } from 'vitest';
import { defineComponent } from 'vue';
import {
  ADMIN_SHELL_OVERRIDE_SLOTS,
  FOOTER_OVERRIDE_KEY,
  LOGIN_EXTRA_OVERRIDE_KEY,
  NAVBAR_ACTIONS_OVERRIDE_KEY,
  WORKBENCH_EXTRA_OVERRIDE_KEY,
} from '../src/index';

it.each([
  LOGIN_EXTRA_OVERRIDE_KEY,
  NAVBAR_ACTIONS_OVERRIDE_KEY,
  WORKBENCH_EXTRA_OVERRIDE_KEY,
  FOOTER_OVERRIDE_KEY,
])('resolves an optional Vue component for %s', (key) => {
  const slots = ADMIN_SHELL_OVERRIDE_SLOTS;
  const value = defineComponent({ render: () => null });
  const override = { key, kind: 'component', contractVersion: '1.0.0', value } as const;

  expect(createAdminOverrideRegistry({ slots }).get(key)).toBeNull();
  expect(createAdminOverrideRegistry({ slots, overrides: [override] }).get(key)).toBe(value);
  expect(
    createAdminOverrideRegistry({
      slots,
      presets: [override],
      overrides: [{ ...override, value: null }],
    }).get(key)
  ).toBeNull();
  expect(() =>
    createAdminOverrideRegistry({
      slots,
      overrides: [{ ...override, value: 'div' }],
    })
  ).toThrow('ADMIN_OVERRIDE');
});
