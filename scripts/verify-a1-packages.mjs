#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyConsumer } from './consumer-verification.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const artifacts = join(root, 'artifacts')
const packages = ['client', 'vue', 'ui-vue', 'nuxt', 'uniapp', 'testing']

const version = process.versions.node.split('.').map(Number)
if (version[0] !== 22 || version[1] < 12) {
  throw new Error(`Node 22.12 or newer within major 22 is required; found ${process.versions.node}`)
}

const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root,
  stdio: 'inherit',
  ...options,
})

const output = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root,
  encoding: 'utf8',
  ...options,
})

const packageManifest = (name) => JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'))
const expectedVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
for (const name of packages) {
  const manifest = packageManifest(name)
  if (manifest.name !== `@peanut-admin/${name}` || manifest.version !== expectedVersion) {
    throw new Error(`Unexpected package identity for ${name}`)
  }
  if (manifest.exports?.['.']?.import !== './dist/index.js'
    || manifest.exports?.['.']?.types !== './dist/index.d.ts') {
    throw new Error(`Incomplete package exports for ${name}`)
  }
}

run('pnpm', ['run', 'build'])
run('pnpm', ['run', 'test'])
rmSync(artifacts, { recursive: true, force: true })
mkdirSync(artifacts, { recursive: true })
run('pnpm', ['run', 'pack:candidates'])

const tgzs = readdirSync(artifacts).filter(name => name.endsWith('.tgz')).sort()
if (tgzs.length !== packages.length) throw new Error(`Expected six tgz files; found ${tgzs.length}`)

const forbiddenClientRuntime = /(?:from\s+['"](?:vue|element-plus)|\b(?:window|document|localStorage|sessionStorage|navigator|BroadcastChannel|HTMLElement)\b)/
for (const relative of ['packages/client/src/index.ts', 'packages/client/dist/index.js', 'packages/client/dist/index.d.ts']) {
  const contents = readFileSync(join(root, relative), 'utf8')
  if (forbiddenClientRuntime.test(contents)) throw new Error(`Client runtime boundary violation in ${relative}`)
}

for (const tgz of tgzs) {
  const manifest = JSON.parse(output('tar', ['-xOf', join(artifacts, tgz), 'package/package.json']))
  if (!packages.some(name => manifest.name === `@peanut-admin/${name}`)) {
    throw new Error(`Unexpected tgz identity: ${manifest.name}`)
  }
  const contents = output('tar', ['-tf', join(artifacts, tgz)])
  for (const required of ['package/package.json', 'package/LICENSE', 'package/dist/index.js', 'package/dist/index.d.ts']) {
    if (!contents.split('\n').includes(required)) throw new Error(`${tgz} is missing ${required}`)
  }
}

const consumer = mkdtempSync(join(tmpdir(), 'peanut-a1-web-consumer-'))
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
writeFileSync(join(consumer, 'index.html'), '<!doctype html><html><body><script type="module" src="/index.js"></script></body></html>')
writeFileSync(join(consumer, 'index.js'), [
  "import { createClient } from '@peanut-admin/client'",
  "import { defineAdminModule } from '@peanut-admin/vue'",
  "import { AdminShell } from '@peanut-admin/ui-vue'",
  "import { createNuxtClientTransport } from '@peanut-admin/nuxt'",
  "import { createUniAppClientTransport } from '@peanut-admin/uniapp'",
  "import { mockAccessState } from '@peanut-admin/testing'",
  'console.log(Boolean(createClient && defineAdminModule && AdminShell && createNuxtClientTransport && createUniAppClientTransport && mockAccessState))',
].join('\n'))

verifyConsumer(consumer, () => {
  run('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund',
    'vite@7.3.6', 'vue@3.5.39', 'pinia@4.0.2', 'element-plus@2.14.3',
    ...tgzs.map(tgz => join(artifacts, tgz)),
  ], { cwd: consumer })
  run(join(consumer, 'node_modules', '.bin', 'vite'), ['build'], { cwd: consumer })
  console.log(JSON.stringify({
    node: process.versions.node,
    sourceCommit: output('git', ['rev-parse', 'HEAD']).trim(),
    sourceDirty: output('git', ['status', '--porcelain']).trim() !== '',
    packageCount: tgzs.length,
    cleanConsumer: 'passed',
  }))
})
