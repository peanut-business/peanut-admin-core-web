import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const coreRoot = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const packageNames = ['client', 'vue', 'ui-vue', 'nuxt', 'uniapp', 'testing'];
const credentialVariable = 'PEANUT_CORE_WRITER_CREDENTIALS';
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
function directory(path) {
  try { mkdirSync(path); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Core writer directory is invalid: ${path}`);
}
function ancestors() {
  const result = new Set();
  let pid = process.pid;
  while (pid > 1 && !result.has(pid)) {
    result.add(pid);
    const parent = spawnSync('ps', ['-p', String(pid), '-o', 'ppid='], { encoding: 'utf8' });
    if (parent.status !== 0 || !/^\s*\d+\s*$/.test(parent.stdout)) throw new Error('Cannot verify inherited Core writer ancestry');
    pid = Number(parent.stdout.trim());
  }
  return result;
}

// One canonical Core checkout and one atomic directory per output package.
// Inherited credentials only reuse a live ancestor; they never own cleanup.
export function acquireCoreWriters(core, names, { repository, operation }) {
  core = realpathSync(core);
  if (core !== coreRoot) throw new Error('Core writer tool belongs to another selected checkout');
  const selected = [...new Set(names)].sort();
  if (!selected.length || selected.some(name => !packageNames.includes(name))) throw new Error('Invalid Core writer package set');
  const inherited = JSON.parse(process.env[credentialVariable] || '[]');
  if (!Array.isArray(inherited)) throw new Error('Invalid inherited Core writer credentials');
  directory(join(core, '.local'));
  const parent = join(core, '.local', 'client-watch');
  directory(parent);
  const owned = [];
  const credentials = inherited.filter(item => item.core !== core || !selected.includes(item.name));
  let ancestorPids;
  function release() {
    for (const record of owned.splice(0).reverse()) {
      try {
        const stat = lstatSync(record.path);
        const files = readdirSync(record.path);
        const ownerPath = join(record.path, 'owner.json');
        const ownerStat = lstatSync(ownerPath);
        const owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
        if (!sameFile(stat, record.stat) || stat.isSymbolicLink() || files.length !== 1 || files[0] !== 'owner.json'
            || !ownerStat.isFile() || ownerStat.isSymbolicLink() || ownerStat.nlink !== 1
            || owner.token !== record.token || owner.pid !== process.pid) throw new Error('ownership changed');
        unlinkSync(ownerPath);
        rmdirSync(record.path);
      } catch (error) {
        console.error(`Core writer record retained; inspect ${record.path}: ${error.message}`);
      }
    }
  }
  try {
    for (const name of selected) {
      const path = join(parent, name);
      const existing = inherited.find(item => item.core === core && item.name === name);
      if (existing) {
        const stat = lstatSync(path);
        const ownerPath = join(path, 'owner.json');
        const ownerStat = lstatSync(ownerPath);
        const owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
        ancestorPids ??= ancestors();
        if (!stat.isDirectory() || stat.isSymbolicLink() || !ownerStat.isFile() || ownerStat.isSymbolicLink()
            || ownerStat.nlink !== 1 || owner.token !== existing.token || owner.pid !== existing.pid
            || !ancestorPids.has(owner.pid)) throw new Error(`Invalid inherited Core writer: ${name}`);
        credentials.push(existing);
        continue;
      }
      try { mkdirSync(path); }
      catch (error) { throw new Error(`Core writer unavailable: ${name}; inspect ${path}/owner.json (${error.code})`); }
      const token = randomUUID();
      const record = { core, name, token, pid: process.pid, repository, operation };
      // A failed write is an unknown record: retain it rather than clearing it.
      writeFileSync(join(path, 'owner.json'), JSON.stringify(record) + '\n', { flag: 'wx', mode: 0o600 });
      owned.push({ path, stat: lstatSync(path), token });
      credentials.push(record);
    }
  } catch (error) { release(); throw error; }
  const env = { ...process.env, [credentialVariable]: JSON.stringify(credentials) };
  return { env, release, ownsRecords: owned.length > 0 };
}

export async function runWriterCommand(leases, argv) {
  const env = leases.at(-1).env;
  if (!leases.some(lease => lease.ownsRecords)) {
    const child = spawnSync(argv[0], argv.slice(1), { env, stdio: 'inherit' });
    return child.status ?? 1;
  }
  const child = spawn(argv[0], argv.slice(1), { env, stdio: 'inherit', detached: true });
  let stopping = false;
  let closed = false;
  let exitCode = 1;
  let timer;
  function signal(value) {
    if (!child.pid) return;
    try { process.kill(-child.pid, value); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  function stop(code) {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    signal('SIGTERM');
    timer = setTimeout(() => signal('SIGKILL'), 5000);
  }
  for (const [name, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(name, () => stop(code));
  child.on('error', error => { console.error(error.message); closed = true; stop(1); });
  child.on('close', code => { closed = true; if (!stopping) exitCode = code ?? 1; });
  await new Promise(resolve => {
    const poll = setInterval(() => {
      if (!closed) return;
      if (child.pid) {
        try { process.kill(-child.pid, 0); return; }
        catch (error) { if (error.code !== 'ESRCH') { console.error(error.message); return; } }
      }
      clearInterval(poll);
      clearTimeout(timer);
      for (const lease of [...leases].reverse()) lease.release();
      resolve();
    }, 50);
  });
  return exitCode;
}

async function main() {
  const argv = process.argv.slice(2);
  const options = {};
  while (argv[0] !== '--') {
    const key = argv.shift();
    if (!['--packages', '--repository', '--operation'].includes(key) || !argv.length) throw new Error('Invalid Core writer arguments');
    options[key] = argv.shift();
  }
  argv.shift();
  if (!argv.length || !options['--packages']) throw new Error('Core writer command and packages are required');
  const names = options['--packages'] === 'all' ? packageNames : options['--packages'].split(',');
  const lease = acquireCoreWriters(coreRoot, names, { repository: options['--repository'] || process.cwd(), operation: options['--operation'] || 'build' });
  process.exitCode = await runWriterCommand([lease], argv);
}

if (process.argv[1] && process.argv[1] !== '-' && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
