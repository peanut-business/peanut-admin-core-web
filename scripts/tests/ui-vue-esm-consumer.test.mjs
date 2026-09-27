import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageRoot = join(root, 'packages/ui-vue');
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8')
);
const entry = resolve(packageRoot, manifest.exports['.'].import);
assert.ok(entry.startsWith(packageRoot + sep));
const importEntry = `import * as api from ${JSON.stringify(
  pathToFileURL(entry).href
)};`;

function consume(source) {
  const temporaryRoot = resolve(process.env.TMPDIR || '');
  const owned = relative(join(root, '.local/tmp'), temporaryRoot);
  assert.ok(
    owned !== '..' && !owned.startsWith('..' + sep),
    'Use this checkout-owned TMPDIR'
  );
  const directory = mkdtempSync(join(temporaryRoot, 'ui-vue-esm-'));
  try {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', importEntry + source],
      { cwd: directory, encoding: 'utf8', timeout: 15000 }
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim());
  } finally {
    rmSync(directory, { recursive: true });
  }
}

test('compiled UI public entry loads in native Node ESM without a bundler', () => {
  assert.deepEqual(
    consume(`console.log(JSON.stringify({
      name: api.PEANUT_ADMIN_UI_VUE_PACKAGE,
      version: api.PEANUT_ADMIN_UI_VUE_VERSION,
      browser: typeof globalThis.window,
      exports: [api.AdminShell, api.PlatformShell, api.PageHeader,
        api.EmptyState, api.TargetSelector].map(value => typeof value)
    }));`),
    {
      name: manifest.name,
      version: manifest.version,
      browser: 'undefined',
      exports: ['object', 'object', 'object', 'object', 'object'],
    }
  );
});

test('native UI entry preserves config validation and tab projection', () => {
  const actual = consume(`
    const input = {brand: {name: ' Fixture ', mark: 'F'},
      audiences: {tenant: {label: 'Tenant'}, platform: {label: 'Platform'}},
      commands: {switchTenantLabel: 'Switch', logoutLabel: 'Exit'}};
    const config = api.defineShellHostConfig(input);
    let rejected = false;
    try { api.defineShellHostConfig({...input, unauthorized: true}); }
    catch (error) { rejected = error.message === 'SHELL_CONFIG_UNKNOWN_FIELD:unauthorized'; }
    const tab = api.tabFromRoute({name: 'orders', fullPath: '/orders?page=2',
      query: {page: '2'}, meta: {locale: 'Orders', ignoreCache: true}});
    console.log(JSON.stringify({brand: config.brand.name,
      frozen: Object.isFrozen(config) && Object.isFrozen(config.brand), rejected, tab}));
  `);
  assert.deepEqual(actual, {
    brand: 'Fixture',
    frozen: true,
    rejected: true,
    tab: {
      title: 'Orders',
      name: 'orders',
      fullPath: '/orders?page=2',
      query: { page: '2' },
      ignoreCache: true,
    },
  });
});

test('emitted UI declarations retain resolvable relative ESM paths', () => {
  let checked = 0;
  const dist = join(packageRoot, 'dist');
  for (const name of readdirSync(dist).filter((name) =>
    name.endsWith('.d.ts')
  )) {
    const source = readFileSync(join(dist, name), 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
      checked++;
      assert.ok(match[1].endsWith('.js'), `${name}: ${match[1]}`);
      assert.ok(existsSync(resolve(dist, match[1])), `${name}: ${match[1]}`);
    }
  }
  assert.ok(checked > 0, 'No relative declaration paths were checked');
});
