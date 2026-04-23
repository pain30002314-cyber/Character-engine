'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createTempDir, freshRequire } = require('./memory/llm/helpers')

test('runExtractFilterObservePipeline returns partial result and skips persistence write', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('observe-pipeline-')

  process.chdir(tempDir)

  try {
    const { runExtractFilterObservePipeline } = freshRequire(
      'src/core/memory/pipeline/extract-filter-observe.pipeline.js'
    )
    const persistenceLogPath = path.join(process.cwd(), 'logs', 'memory', 'persistence.jsonl')

    const result = await runExtractFilterObservePipeline({
      threadId: 'thread-1',
      event: {
        id: 'evt-1',
        threadId: 'thread-1',
        role: 'user',
        text: 'test event',
        timestamp: '2026-04-23T12:00:00.000Z'
      },
      history: [],
      extractionConfig: {
        mode: 'llm_only',
        wideLlmExtractorEnabled: true,
        disablePersistenceWrite: true
      },
      runtimeImpl: async () => ({
        traceId: 'trace-1',
        service: {
          warnings: []
        },
        orchestration: {
          status: 'partial',
          candidatePool: {
            traceId: 'trace-1',
            eventId: 'evt-1',
            threadId: 'thread-1',
            candidates: []
          },
          persistencePacket: {
            traceId: 'trace-1',
            eventId: 'evt-1',
            threadId: 'thread-1',
            resolutionMeta: {
              nodeCount: 1,
              factCount: 1,
              episodeCount: 0,
              edgeCount: 0,
              derivedCount: 0,
              reflectionCount: 0
            }
          },
          passes: {
            failed: [
              {
                error: {
                  message: 'single_pass_failed'
                }
              }
            ]
          }
        },
        persistencePacket: {
          traceId: 'trace-1',
          eventId: 'evt-1',
          threadId: 'thread-1',
          resolutionMeta: {
            nodeCount: 1,
            factCount: 1
          }
        }
      }),
      regexExtractor: async () => ({
        version: 1,
        atoms: []
      })
    })

    const after = fs.readFileSync(persistenceLogPath, 'utf8').trim().split('\n').filter(Boolean).length

    assert.equal(result.traceId, 'trace-1')
    assert.equal(result.status, 'partial')
    assert.equal(result.persistenceSkipped, true)
    assert.equal(result.candidatePool?.threadId, 'thread-1')
    assert.equal(result.storagePacket?.traceId, 'trace-1')
    assert.match(result.warnings.join(' '), /persistence_skipped_by_config/)
    assert.deepEqual(result.errors, ['single_pass_failed'])
    assert.equal(after, 1)
  } finally {
    process.chdir(previousCwd)
  }
})
