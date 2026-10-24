#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = resolve(process.env.CORE_RELEASE_ARTIFACTS || join(root, 'artifacts'));
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const tools = () => ({ node: process.version, npm: run('npm', ['--version']), pnpm: run('pnpm', ['--version']) });
const inputs = () => {
  run('git', ['diff', '--exit-code', 'HEAD', '--']);
  if (run('git', ['ls-files', '--others', '--exclude-standard'])) throw new Error('Untracked source must be committed before sealing inputs');
  return { tree: run('git', ['rev-parse', 'HEAD^{tree}']), lock: hash(readFileSync(join(root, 'pnpm-lock.yaml'))), tools: tools() };
};
const names = ['client', 'vue', 'ui-vue', 'nuxt', 'uniapp', 'testing'];
const manifestPath = join(dir, 'release-identity.json');
const mode = process.argv[2];
if (mode === 'pack') {
  mkdirSync(dir, { recursive: true });
  if (readdirSync(dir).length) throw new Error('Release output must be fresh; preserve existing qualification evidence');
  const inputIdentity = inputs();
  const packages = names.map((name) => {
    const [packed] = JSON.parse(run('npm', ['pack', `./packages/${name}`, '--json', '--pack-destination', dir]));
    const bytes = readFileSync(join(dir, packed.filename));
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    if (integrity !== packed.integrity) throw new Error(`npm pack integrity differs: ${name}`);
    return { name: packed.name, version: packed.version, filename: packed.filename, integrity, sha256: hash(bytes) };
  });
  writeFileSync(manifestPath, JSON.stringify({ schema: 1, sourceCommit: run('git', ['rev-parse', 'HEAD']), inputs: inputIdentity, packages }, null, 2) + '\n');
} else if (mode === 'verify' || mode === 'qualify') {
  const identity = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (identity.schema !== 1 || JSON.stringify(identity.inputs) !== JSON.stringify(inputs())) throw new Error('Qualification source tree, lock or tool inputs differ');
  if (identity.packages?.length !== names.length || new Set(identity.packages.map((p) => p.name)).size !== names.length) throw new Error('Expected six unique qualified packages');
  for (const p of identity.packages) {
    if (!names.some((name) => p.name === `@peanut-admin/${name}`) || p.filename !== `peanut-admin-${p.name.split('/')[1]}-${p.version}.tgz`) throw new Error('Unexpected package identity');
    const bytes = readFileSync(join(dir, p.filename));
    if (hash(bytes) !== p.sha256 || `sha512-${createHash('sha512').update(bytes).digest('base64')}` !== p.integrity) throw new Error(`Qualified bytes differ: ${p.name}`);
  }
  if (mode === 'qualify') {
    identity.consumerLockSha256 = hash(readFileSync(join(dir, 'consumer-package-lock.json')));
    identity.qualified = true;
    writeFileSync(manifestPath, JSON.stringify(identity, null, 2) + '\n');
  } else if (identity.qualified !== true || identity.consumerLockSha256 !== hash(readFileSync(join(dir, 'consumer-package-lock.json')))) throw new Error('Package consumer qualification did not complete or its dependency lock differs');
  console.log(`Web Core ${mode}: ${identity.packages.length} exact packages`);
} else if (mode === 'registry') {
  const identity = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const pkg = identity.packages.find((p) => p.name === process.argv[3]);
  if (!pkg || identity.qualified !== true) throw new Error('Package is not qualified');
  const metadata = JSON.parse(readFileSync(process.argv[4], 'utf8'));
  if (metadata.name !== pkg.name || metadata.version !== pkg.version || metadata.dist?.integrity !== pkg.integrity) throw new Error('Registry metadata differs from qualified package');
  const url = new URL(metadata.dist.tarball);
  if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org') throw new Error('Unexpected registry tarball origin');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tarball download HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== pkg.sha256) throw new Error('Actual registry tarball bytes differ from qualification');
  console.log(`${pkg.name}@${pkg.version}: registry bytes matched ${pkg.sha256}`);
} else throw new Error('Usage: release-identity.mjs pack|qualify|verify|registry [name metadata.json]');
