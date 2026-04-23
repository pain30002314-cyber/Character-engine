'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  writeMemoryDebug
} = require('../src/core/memory/debug/memory-debug.service')

test('writeMemoryDebug appends normalized packets into one stage jsonl file', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-debug-'))

  try {
    const first = writeMemoryDebug(
      {
        layer: 'Filter LLM/V1',
        timestamp: '2026-04-22T12:34:56.789Z',
        threadId: 'telegram:123',
        messageId: 'msg_1',
        eventId: 'evt_1',
        sourceEventId: 'src_1',
        input: { candidateCount: 2 },
        output: { accepted: 1 },
        meta: { usedModel: 'mock-model' },
        errors: ['parse_warning']
      },
      {
        baseDir,
        enabled: true
      }
    )

    const second = writeMemoryDebug(
      {
        layer: 'Filter LLM/V1',
        timestamp: '2026-04-22T12:35:56.789Z',
        threadId: 'telegram:999',
        eventId: 'evt_2',
        input: { candidateCount: 4 },
        output: { accepted: 2 }
      },
      {
        baseDir,
        enabled: true
      }
    )

    assert.equal(first.enabled, true)
    assert.equal(second.enabled, true)
    assert.equal(first.filePath, path.join(baseDir, 'filter-llm-v1.jsonl'))
    assert.equal(second.filePath, first.filePath)

    const lines = fs
      .readFileSync(first.filePath, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)

    assert.equal(lines.length, 2)

    const firstPacket = JSON.parse(lines[0])
    const secondPacket = JSON.parse(lines[1])

    assert.equal(firstPacket.layer, 'filter-llm-v1')
    assert.equal(firstPacket.threadId, 'telegram:123')
    assert.equal(firstPacket.messageId, 'msg_1')
    assert.equal(firstPacket.eventId, 'evt_1')
    assert.equal(firstPacket.sourceEventId, 'src_1')
    assert.deepEqual(firstPacket.input, { candidateCount: 2 })
    assert.deepEqual(firstPacket.output, { accepted: 1 })
    assert.deepEqual(firstPacket.meta, { usedModel: 'mock-model' })
    assert.deepEqual(firstPacket.errors, ['parse_warning'])

    assert.equal(secondPacket.layer, 'filter-llm-v1')
    assert.equal(secondPacket.threadId, 'telegram:999')
    assert.equal(secondPacket.eventId, 'evt_2')
    assert.deepEqual(secondPacket.input, { candidateCount: 4 })
    assert.deepEqual(secondPacket.output, { accepted: 2 })
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true })
  }
})

test('writeMemoryDebug skips file write when disabled', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-debug-disabled-'))

  try {
    const result = writeMemoryDebug(
      {
        layer: 'extractor-llm',
        eventId: 'evt_2'
      },
      {
        baseDir,
        enabled: false
      }
    )

    assert.equal(result.enabled, false)
    assert.equal(result.filePath, null)
    assert.equal(fs.existsSync(path.join(baseDir, 'extractor-llm.jsonl')), false)
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true })
  }
})
