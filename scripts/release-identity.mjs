#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, realpathSync, lstatSync, existsSync, readlinkSync } from 'node:fs';
import { resolve, join, dirname, relative, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireCoreWriters } from './local-core-writer.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = resolve(process.env.CORE_RELEASE_ARTIFACTS || join(root, 'artifacts'));
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const names = ['client', 'vue', 'ui-vue', 'nuxt', 'uniapp', 'testing'];
const policyPath = join(root, 'tools/build-inputs.json');
const policy = JSON.parse(readFileSync(policyPath));
const sealPath = resolve(process.env.CORE_BUILD_INPUTS || join(root, '.local/build-inputs.json'));
const packageRoot = (name) => {
  let path = name === 'typescript' ? realpathSync(join(root, 'node_modules/typescript')) : dirname(realpathSync(run('which', [name])));
  while (path !== dirname(path)) {
    if (existsSync(join(path, 'package.json')) && JSON.parse(readFileSync(join(path, 'package.json'))).name === name) return path;
    path = dirname(path);
  }
  throw new Error(`Cannot identify the actual ${name} distribution`);
};
const producerEnv = () => {
  const env = { ...process.env, ...policy.environment };
  for (const key of Object.keys(env)) if (/^npm_config_/i.test(key)) delete env[key];
  env.NPM_CONFIG_USERCONFIG = '/dev/null';
  env.NPM_CONFIG_GLOBALCONFIG = '/dev/null';
  env.PATH = [dirname(run('which', ['pnpm'])), dirname(run('which', ['npm'])), dirname(process.execPath), process.env.PATH].join(':');
  if (realpathSync(execFileSync('which', ['node'], { env, encoding: 'utf8' }).trim()) !== realpathSync(process.execPath)) throw new Error('Child Node lookup differs from the recorded executable');
  return env;
};
const moduleIdentity = (name) => {
  const path = packageRoot(name);
  const manifest = JSON.parse(readFileSync(join(path, 'package.json')));
  const records = [];
  const nativeBinLink = (file) => {
    if (basename(dirname(file)) !== '.bin' || basename(dirname(dirname(file))) !== 'node_modules' || isAbsolute(readlinkSync(file))) return false;
    const target = realpathSync(file), within = relative(path, target);
    if (within.startsWith('../') || isAbsolute(within) || !lstatSync(target).isFile()) return false;
    const modules = dirname(dirname(file));
    for (let folder = dirname(target); folder !== modules && folder !== dirname(folder); folder = dirname(folder)) {
      const manifestPath = join(folder, 'package.json');
      if (!existsSync(manifestPath)) continue;
      const pkg = JSON.parse(readFileSync(manifestPath));
      if (resolve(modules, pkg.name || '') !== folder) continue;
      const bins = typeof pkg.bin === 'string' ? { [pkg.name.split('/').pop()]: pkg.bin } : (pkg.bin || {});
      return typeof bins[basename(file)] === 'string' && resolve(folder, bins[basename(file)]) === target;
    }
    return false;
  };
  const visit = (folder) => {
    for (const entry of readdirSync(folder).sort()) {
      const file = join(folder, entry), stat = lstatSync(file);
      if (stat.isDirectory()) visit(file);
      else if (stat.isFile()) records.push([relative(path, file), hash(readFileSync(file))]);
      else if (stat.isSymbolicLink() && nativeBinLink(file)) continue;
      else throw new Error(`Unexpected link or special entry in ${name} distribution`);
    }
  };
  visit(path);
  records.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const contentSha256 = hash(records.map(([name, digest]) => `${name}\0${digest}\0`).join(''));
  const expected = policy.modules[name];
  if (manifest.version !== expected.version || contentSha256 !== expected.moduleSha256 || records.length !== expected.moduleFiles) throw new Error(`${name} installed distribution differs from its pinned official payload`);
  return { version: manifest.version, distribution: { url: expected.url, sha256: expected.sha256 }, contentSha256, files: records.length };
};
const sourceInputs = () => {
  run('git', ['diff', '--exit-code', 'HEAD', '--']);
  if (run('git', ['ls-files', '--others', '--exclude-standard'])) throw new Error('Untracked source must be committed before sealing inputs');
  const files = ['tools/build-inputs.json', 'scripts/release-identity.mjs', 'scripts/verify-a1-packages.mjs', 'scripts/local-core-writer.mjs', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', '.github/workflows/ci.yml', '.github/workflows/release.yml', ...names.flatMap(name => [`packages/${name}/package.json`, `packages/${name}/tsconfig.json`]), ...['.npmrc', ...names.map(name => `packages/${name}/.npmrc`)].filter(name => existsSync(join(root, name)))];
  return { tree: run('git', ['rev-parse', 'HEAD^{tree}']), files: Object.fromEntries(files.map(name => [name, hash(readFileSync(join(root, name)))])), lock: hash(readFileSync(join(root, 'pnpm-lock.yaml'))) };
};
const captureInputs = () => {
  if (process.version !== `v${policy.node.version}` || hash(readFileSync(process.execPath)) !== policy.node.binarySha256) throw new Error('Actual Node executable differs from the pinned official distribution');
  if (process.config.variables.node_shared_zlib !== false) throw new Error('This Node supply contract requires its embedded zlib');
  for (const name of names) {
    const scripts = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'))).scripts || {};
    if (['prepack', 'prepare', 'postpack'].some(key => scripts[key])) throw new Error('Pack lifecycle hooks require a new producer policy');
  }
  producerEnv();
  return { ...sourceInputs(), policySha256: hash(readFileSync(policyPath)), producer: { args: { build: policy.buildArgs, pack: policy.packArgs }, environment: policy.environment, npmConfig: policy.npmConfig, node: { version: process.version, binarySha256: policy.node.binarySha256, distribution: { url: policy.node.url, sha256: policy.node.sha256 }, zlib: { linkage: 'embedded', version: process.versions.zlib, coveredBy: 'node.binarySha256' } }, modules: Object.fromEntries(['npm', 'pnpm', 'typescript'].map(name => [name, moduleIdentity(name)])) } };
};
const readSeal = () => JSON.parse(readFileSync(sealPath, 'utf8'));
const validateSupply = (seal) => {
  if (seal.schema !== 2 || seal.inputs?.policySha256 !== hash(readFileSync(policyPath)) || !seal.provenance || JSON.stringify(Object.keys(seal.provenance).sort()) !== JSON.stringify(['githubRunAttempt', 'githubRunId', 'runnerImageVersion'])) throw new Error('Missing or different build-inputs contract');
  const source = sourceInputs();
  for (const key of ['tree', 'files', 'lock']) if (JSON.stringify(seal.inputs[key]) !== JSON.stringify(source[key])) throw new Error(`Build input ${key} differs`);
  const p = seal.inputs.producer;
  if (JSON.stringify(p?.args) !== JSON.stringify({ build: policy.buildArgs, pack: policy.packArgs }) || JSON.stringify(p.environment) !== JSON.stringify(policy.environment) || p.npmConfig !== policy.npmConfig || p.node?.version !== `v${policy.node.version}` || p.node.binarySha256 !== policy.node.binarySha256 || p.node.distribution?.sha256 !== policy.node.sha256 || p.node.distribution?.url !== policy.node.url || p.node.zlib?.linkage !== 'embedded' || p.node.zlib.coveredBy !== 'node.binarySha256' || !p.node.zlib.version) throw new Error('Producer arguments or Node supply contract differs');
  for (const [name, expected] of Object.entries(policy.modules)) {
    const actual = p.modules?.[name];
    if (actual?.version !== expected.version || actual.contentSha256 !== expected.moduleSha256 || actual.files !== expected.moduleFiles || actual.distribution?.url !== expected.url || actual.distribution?.sha256 !== expected.sha256) throw new Error(`Missing or different ${name} supply contract`);
  }
  if (!/^[0-9a-f]{40}$/.test(seal.sourceCommit) || run('git', ['cat-file', '-t', seal.sourceCommit]) !== 'commit' || run('git', ['rev-parse', '--verify', `${seal.sourceCommit}^{tree}`]) !== seal.inputs.tree) throw new Error('Build-input seal source differs from real Git objects');
};
const verifyCurrentInputs = () => {
  const seal = readSeal(); validateSupply(seal);
  if (seal.sourceCommit !== run('git', ['rev-parse', 'HEAD']) || JSON.stringify(seal.inputs) !== JSON.stringify(captureInputs())) throw new Error('Effective build inputs drifted after sealing');
  return seal;
};
const artifactSeal = (identity) => {
  if (identity.schema !== 2) throw new Error('Expected release identity schema 2');
  const bytes = readFileSync(join(dir, 'build-inputs.json'));
  if (hash(bytes) !== identity.inputSealSha256) throw new Error('Build-input seal bytes differ');
  const seal = JSON.parse(bytes); validateSupply(seal);
  if (seal.sourceCommit !== identity.sourceCommit || JSON.stringify(seal.inputs) !== JSON.stringify(identity.inputs)) throw new Error('Artifact input seal identity differs');
  return seal;
};
const recordVerifier = (identity) => {
  const record = { role: 'package-digest/registry verification', nodeVersion: process.version, nodeBinarySha256: hash(readFileSync(process.execPath)), gitObjectVerifier: { version: run('git', ['--version']), binarySha256: hash(readFileSync(realpathSync(run('which', ['git'])))) }, scriptSha256: hash(readFileSync(fileURLToPath(import.meta.url))), inputSealSha256: identity.inputSealSha256 };
  const target = join(dir, 'verification-inputs.json');
  if (existsSync(target)) {
    if (JSON.stringify(JSON.parse(readFileSync(target))) !== JSON.stringify(record)) throw new Error('Package verifier inputs drifted between release steps');
  } else writeFileSync(target, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
};
const manifestPath = join(dir, 'release-identity.json');
const mode = process.argv[2];
if (mode === 'inputs') {
  if (existsSync(sealPath)) verifyCurrentInputs();
  else {
    const seal = { schema: 2, sourceCommit: run('git', ['rev-parse', 'HEAD']), inputs: captureInputs(), provenance: { githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null, githubRunId: process.env.GITHUB_RUN_ID || null, runnerImageVersion: process.env.ImageVersion || null } };
    mkdirSync(dirname(sealPath), { recursive: true }); writeFileSync(sealPath, JSON.stringify(seal, null, 2) + '\n', { flag: 'wx' });
  }
  console.log('Web build inputs: actual source, binary and distribution content sealed/verified');
} else if (mode === 'build') {
  verifyCurrentInputs();
  const writers = acquireCoreWriters(root, names, { repository: root, operation: 'build' });
  try {
    for (const name of names) {
      execFileSync(process.execPath, policy.buildArgs.map(arg => arg === '<typescript>/bin/tsc' ? join(packageRoot('typescript'), 'bin/tsc') : arg), { cwd: join(root, 'packages', name), env: producerEnv(), stdio: 'inherit' });
    }
  } finally { writers.release(); }
  verifyCurrentInputs();
} else if (mode === 'pack') {
  mkdirSync(dir, { recursive: true });
  if (readdirSync(dir).length) throw new Error('Release output must be fresh; preserve existing qualification evidence');
  const seal = verifyCurrentInputs();
  const packages = names.map((name) => {
    const args = policy.packArgs.map(arg => arg === '<package>' ? `./packages/${name}` : arg === '<output>' ? dir : arg);
    const [packed] = JSON.parse(execFileSync(process.execPath, [join(packageRoot('npm'), 'bin/npm-cli.js'), ...args], { cwd: root, env: producerEnv(), encoding: 'utf8' }));
    const bytes = readFileSync(join(dir, packed.filename));
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    if (integrity !== packed.integrity) throw new Error(`npm pack integrity differs: ${name}`);
    return { name: packed.name, version: packed.version, filename: packed.filename, integrity, sha256: hash(bytes) };
  });
  verifyCurrentInputs();
  const sealBytes = readFileSync(sealPath); writeFileSync(join(dir, 'build-inputs.json'), sealBytes);
  writeFileSync(manifestPath, JSON.stringify({ schema: 2, sourceCommit: seal.sourceCommit, inputs: seal.inputs, inputSealSha256: hash(sealBytes), packages }, null, 2) + '\n');
} else if (mode === 'verify' || mode === 'qualify') {
  const identity = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (process.env.CORE_QUALIFICATION_COMMIT && identity.sourceCommit !== process.env.CORE_QUALIFICATION_COMMIT) throw new Error('Artifact source does not match the selected qualification run');
  if (!/^[0-9a-f]{40}$/.test(identity.sourceCommit) || run('git', ['cat-file', '-t', identity.sourceCommit]) !== 'commit') throw new Error('Qualification source is not an available commit object');
  const sourceTree = run('git', ['rev-parse', '--verify', `${identity.sourceCommit}^{tree}`]);
  if (sourceTree !== identity.inputs?.tree) throw new Error('Qualification commit object tree differs from the artifact');
  artifactSeal(identity);
  if (mode === 'qualify' && JSON.stringify(verifyCurrentInputs().inputs) !== JSON.stringify(identity.inputs)) throw new Error('Qualification build inputs differ');
  if (mode === 'verify') recordVerifier(identity);
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
  artifactSeal(identity);
  recordVerifier(identity);
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
} else throw new Error('Usage: release-identity.mjs inputs|build|pack|qualify|verify|registry [name metadata.json]');
