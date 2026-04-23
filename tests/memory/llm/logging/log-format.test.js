'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const { createTempDir, freshRequire } = require('../helpers')

test('log modules write expected structured fields without using console as source of truth', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('memory-log-format-')

  process.chdir(tempDir)

  try {
    const { logPassRun } = freshRequire('src/core/memory/extractors/llm/logging/log-pass-run.js')
    const { logMerge } = freshRequire('src/core/memory/extractors/llm/logging/log-merge.js')
    const { writeFailureLog } = freshRequire('src/core/memory/extractors/llm/logging/write-failure-log.js')

    await logPassRun({
      traceId: 'trace-1',
      eventId: 'evt-1',
      threadId: 'thread-1',
      extractorName: 'Fact',
      sourcePass: 'fact',
      status: 'partial',
      rawResponseText: '{"candidates":[]}'
    })
    await logMerge({
      traceId: 'trace-1',
      eventId: 'evt-1',
      threadId: 'thread-1',
      status: 'completed',
      totalInputCandidates: 3,
      totalOutputCandidates: 2
    })
    await writeFailureLog({
      traceId: 'trace-1',
      eventId: 'evt-1',
      threadId: 'thread-1',
      failedStage: 'fact',
      error: new Error('boom')
    })

    const extractorLog = fs.readFileSync('logs/memory/extractor-fact.jsonl', 'utf8').trim().split('\n').map(JSON.parse)
    const mergeLog = fs.readFileSync('logs/memory/merge.jsonl', 'utf8').trim().split('\n').map(JSON.parse)
    const failureLog = fs.readFileSync('logs/memory/failures.jsonl', 'utf8').trim().split('\n').map(JSON.parse)

    assert.equal(typeof extractorLog[0].rawResponseText, 'string')
    assert.equal(mergeLog[0].counts.totalInputCandidates, 3)
    assert.equal(failureLog[0].failedStage, 'fact')
  } finally {
    process.chdir(previousCwd)
  }
})
