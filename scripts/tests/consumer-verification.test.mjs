import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { verifyConsumer } from '../consumer-verification.mjs'

// 每例仅操作自己创建的目录；不安装依赖、不运行网络请求或真实产品构建。
test('验证成功后清理本次消费者目录，并保留返回值', () => {
  const dir = mkdtempSync(join(tmpdir(), 'peanut-consumer-success-'))
  try {
    const result = verifyConsumer(dir, () => {
      writeFileSync(join(dir, 'proof.txt'), 'verified')
      return 'passed'
    })
    assert.equal(result, 'passed')
    assert.equal(existsSync(dir), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('异常且进程退出码尚未设置时仍保留现场，并传播原异常', () => {
  const dir = mkdtempSync(join(tmpdir(), 'peanut-consumer-failure-'))
  const marker = join(dir, 'diagnostic.txt')
  const original = new Error('expected consumer build failure')
  const before = process.exitCode
  try {
    process.exitCode = undefined
    assert.throws(() => verifyConsumer(dir, () => {
      writeFileSync(marker, 'failure evidence')
      throw original
    }), error => error === original)
    assert.equal(existsSync(dir), true)
    assert.equal(readFileSync(marker, 'utf8'), 'failure evidence')
  } finally {
    process.exitCode = before
    rmSync(dir, { recursive: true, force: true })
  }
})

test('本次成功不受进程其他切片退出码影响', () => {
  const dir = mkdtempSync(join(tmpdir(), 'peanut-consumer-exit-code-'))
  const before = process.exitCode
  try {
    process.exitCode = 1
    verifyConsumer(dir, () => writeFileSync(join(dir, 'proof.txt'), 'verified'))
    assert.equal(existsSync(dir), false)
    assert.equal(process.exitCode, 1)
  } finally {
    process.exitCode = before
    rmSync(dir, { recursive: true, force: true })
  }
})
