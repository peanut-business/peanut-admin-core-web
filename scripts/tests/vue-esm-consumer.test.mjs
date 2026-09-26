import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageRoot = join(root, 'packages/vue');
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8')
);
const entry = resolve(packageRoot, manifest.exports['.'].import);
assert.ok(entry.startsWith(packageRoot + sep));

function consume(source) {
  const temporaryRoot = resolve(process.env.TMPDIR || '');
  const owned = relative(join(root, '.local/tmp'), temporaryRoot);
  assert.ok(
    owned !== '..' && !owned.startsWith('..' + sep),
    'Use this checkout-owned TMPDIR'
  );
  const directory = mkdtempSync(join(temporaryRoot, 'vue-esm-'));
  try {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', source],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 15000,
      }
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  } finally {
    rmSync(directory, { recursive: true });
  }
}

const importEntry = `import * as api from ${JSON.stringify(
  pathToFileURL(entry).href
)};`;

test('compiled public entry loads without a source alias or bundler', () => {
  const output = consume(
    importEntry +
      '\nconsole.log(JSON.stringify({ name: api.PEANUT_ADMIN_VUE_PACKAGE, version: api.PEANUT_ADMIN_VUE_VERSION, refresh: typeof api.createMemoryRefreshCoordinator }));'
  );
  assert.deepEqual(JSON.parse(output), {
    name: manifest.name,
    version: manifest.version,
    refresh: 'function',
  });
});

test('native ESM consumer preserves independent refresh scopes', () => {
  const output = consume(
    importEntry +
      `
    const coordinator = api.createMemoryRefreshCoordinator();
    let calls = 0;
    const attempt = (scope) => ({ scope, failedToken: 'expired', getAccessToken: () => 'expired', refresh: async () => { calls++; return 'fresh-' + scope; } });
    const values = await Promise.all([coordinator.coordinate(attempt('tenant-a')), coordinator.coordinate(attempt('tenant-a')), coordinator.coordinate(attempt('tenant-b'))]);
    console.log(JSON.stringify({calls, values}));
  `
  );
  assert.deepEqual(JSON.parse(output), {
    calls: 2,
    values: ['fresh-tenant-a', 'fresh-tenant-a', 'fresh-tenant-b'],
  });
});
