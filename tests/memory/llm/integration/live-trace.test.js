'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  createTempDir,
  freshRequire,
  buildEvent,
  buildCandidate,
  buildCandidatePool
} = require('../helpers')

test('live trace logs runtime decision before wide runtime start', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('memory-live-trace-')

  process.chdir(tempDir)

  try {
    const { runExtractFilterObservePipeline } = freshRequire(
      'src/core/memory/pipeline/extract-filter-observe.pipeline.js'
    )
    const event = buildEvent({
      id: 'evt-live-1',
      threadId: 'thread-live-1'
    })

    await runExtractFilterObservePipeline({
      threadId: event.threadId,
      event,
      extractionConfig: {
        mode: 'llm_only',
        wideLlmExtractorEnabled: true,
        disablePersistenceWrite: true
      },
      runtimeImpl: async () => ({
        traceId: 'trace-live-1',
        service: {
          warnings: [],
          debug: {
            status: 'ok'
          }
        },
        orchestration: {
          status: 'ok',
          candidates: [buildCandidate()],
          candidatePool: buildCandidatePool({
            traceId: 'trace-live-1',
            eventId: event.id,
            threadId: event.threadId
          }),
          persistencePacket: {
            traceId: 'trace-live-1',
            eventId: event.id,
            threadId: event.threadId,
            resolutionMeta: {}
          },
          passes: {
            failed: []
          }
        },
        persistencePacket: {
          traceId: 'trace-live-1',
          resolutionMeta: {}
        }
      })
    })

    const liveTracePath = path.join(tempDir, 'logs', 'memory', 'live-trace.jsonl')
    const entries = fs
      .readFileSync(liveTracePath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))

    const decisionIndex = entries.findIndex((entry) => entry.marker === 'wide_llm_runtime_decision')
    const startedIndex = entries.findIndex((entry) => entry.marker === 'wide_llm_runtime_started')

    assert.notEqual(decisionIndex, -1)
    assert.notEqual(startedIndex, -1)
    assert.ok(decisionIndex < startedIndex)
    assert.match(entries[decisionIndex].note || '', /started/)
    assert.equal(entries[decisionIndex].memoryExtractionMode, 'llm_only')
    assert.equal(entries[decisionIndex].wideLlmExtractorEnabled, true)
  } finally {
    process.chdir(previousCwd)
  }
})
