'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const { createTempDir, freshRequire, buildEvent } = require('../helpers')

test('observe pipeline runs wide runtime, writes logs, and skips persistence write', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('memory-runtime-no-persistence-')

  process.chdir(tempDir)

  try {
    const { runExtractFilterObservePipeline } = freshRequire('src/core/memory/pipeline/extract-filter-observe.pipeline.js')
    const result = await runExtractFilterObservePipeline({
      threadId: 'thread-1',
      event: buildEvent(),
      extractionConfig: {
        mode: 'llm_only',
        wideLlmExtractorEnabled: true,
        disablePersistenceWrite: true
      },
      runtimeImpl: async () => ({
        traceId: 'trace-1',
        service: { warnings: [] },
        orchestration: {
          status: 'ok',
          candidatePool: { traceId: 'trace-1', candidates: [{ candidateId: 'c1' }] },
          persistencePacket: { traceId: 'trace-1', resolutionMeta: { nodeCount: 1 } },
          passes: { failed: [] }
        },
        persistencePacket: { traceId: 'trace-1', resolutionMeta: { nodeCount: 1 } }
      })
    })

    const persistenceLog = fs.readFileSync('logs/memory/persistence.jsonl', 'utf8')

    assert.equal(result.persistenceSkipped, true)
    assert.equal(result.status, 'success')
    assert.equal(result.candidatePool.candidates.length, 1)
    assert.match(persistenceLog, /persistence_skipped_by_config/)
  } finally {
    process.chdir(previousCwd)
  }
})
