'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const { createTempDir, freshRequire } = require('../helpers')

test('traceId can be followed across multiple stage logs in temp directory', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('memory-traceability-')

  process.chdir(tempDir)

  try {
    const { logBasePacket } = freshRequire('src/core/memory/extractors/llm/logging/log-base-packet.js')
    const { logMerge } = freshRequire('src/core/memory/extractors/llm/logging/log-merge.js')

    await logBasePacket({
      traceId: 'trace-shared',
      eventId: 'evt-1',
      threadId: 'thread-1'
    })
    await logMerge({
      traceId: 'trace-shared',
      eventId: 'evt-1',
      threadId: 'thread-1'
    })

    const base = fs.readFileSync('logs/memory/base-packet.jsonl', 'utf8')
    const merge = fs.readFileSync('logs/memory/merge.jsonl', 'utf8')

    assert.match(base, /trace-shared/)
    assert.match(merge, /trace-shared/)
  } finally {
    process.chdir(previousCwd)
  }
})
