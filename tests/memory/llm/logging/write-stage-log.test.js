'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createTempDir, freshRequire } = require('../helpers')

test('writeStageLog writes one valid jsonl line into temp log directory', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('memory-log-stage-')

  process.chdir(tempDir)

  try {
    const { writeStageLog } = freshRequire('src/core/memory/extractors/llm/logging/write-stage-log.js')
    const result = await writeStageLog({
      stage: 'base-packet',
      entry: {
        traceId: 'trace-1',
        eventId: 'evt-1',
        threadId: 'thread-1',
        status: 'captured'
      }
    })

    const content = fs.readFileSync(result.filePath, 'utf8').trim().split('\n')
    assert.equal(content.length, 1)
    const line = JSON.parse(content[0])
    assert.equal(line.logVersion, '1.0.0')
    assert.equal(line.traceId, 'trace-1')
    assert.equal(line.stage, 'base-packet')
  } finally {
    process.chdir(previousCwd)
  }
})
