'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  createTempDir,
  freshRequire,
  buildEvent,
  buildEventWindow,
  buildCandidate,
  buildCandidatePool
} = require('../helpers')

test('llm runtime entrypoint delegates to orchestrator, returns envelope, and writes base packet log', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('llm-runtime-entrypoint-')
  const runtimePath = require.resolve('../../../../src/core/memory/extractors/llm/runtime.js')
  const indexPath = require.resolve('../../../../src/core/memory/extractors/llm/index.js')
  const orchestratorPath = require.resolve('../../../../src/core/memory/extractors/llm/orchestrator.js')
  const event = buildEvent()
  const eventWindow = buildEventWindow()
  const candidate = buildCandidate({
    traceId: 'trace-entry',
    eventId: event.id,
    threadId: event.threadId
  })
  let receivedArgs = null

  process.chdir(tempDir)

  delete require.cache[runtimePath]
  delete require.cache[indexPath]
  delete require.cache[orchestratorPath]

  require.cache[orchestratorPath] = {
    id: orchestratorPath,
    filename: orchestratorPath,
    loaded: true,
    exports: {
      orchestrateWideLlmExtraction: async (args) => {
        receivedArgs = args

        return {
          status: 'ok',
          warnings: ['runtime-warning'],
          candidates: [candidate],
          candidatePool: buildCandidatePool({
            traceId: 'trace-entry',
            eventId: event.id,
            threadId: event.threadId,
            candidates: [candidate]
          }),
          persistencePacket: {
            traceId: 'trace-entry',
            eventId: event.id,
            threadId: event.threadId,
            resolutionMeta: {
              nodeCount: 1
            }
          },
          passes: {
            configured: 7,
            successful: [{ extractorKey: 'fact' }],
            failed: [],
            partialFailure: false
          }
        }
      }
    }
  }

  try {
    const llmExports = freshRequire('src/core/memory/extractors/llm/index.js')

    assert.equal(typeof llmExports.runLlmExtractionRuntime, 'function')

    const result = await llmExports.runLlmExtractionRuntime({
      event,
      eventWindow,
      runtime: {
        traceId: 'trace-entry'
      }
    })

    assert.ok(receivedArgs)
    assert.equal(receivedArgs.event.id, event.id)
    assert.equal(receivedArgs.runtime.traceId, 'trace-entry')
    assert.equal(result.traceId, 'trace-entry')
    assert.equal(result.eventId, event.id)
    assert.equal(result.threadId, event.threadId)
    assert.equal(result.orchestration.status, 'ok')
    assert.equal(result.candidatePool.traceId, 'trace-entry')
    assert.equal(result.persistencePacket.traceId, 'trace-entry')
    assert.deepEqual(result.warnings, ['runtime-warning'])

    const basePacketLog = fs.readFileSync(
      path.join(tempDir, 'logs', 'memory', 'base-packet.jsonl'),
      'utf8'
    )
    const parsedEntry = JSON.parse(basePacketLog.trim().split('\n')[0])

    assert.equal(parsedEntry.traceId, 'trace-entry')
    assert.equal(parsedEntry.eventId, event.id)
    assert.equal(parsedEntry.stage, 'base-packet')
    assert.equal(parsedEntry.counts.extractorPlanCount, 7)
    assert.equal(parsedEntry.extractorPlan.length, 7)

    const runtimeSource = fs.readFileSync(runtimePath, 'utf8')

    assert.doesNotMatch(
      runtimeSource,
      /require\('\.\/prompt'\)|require\('\.\/normalize'\)|require\('\.\/postprocess'\)|tags\.runtime|debug\/llm\.debug/
    )
  } finally {
    process.chdir(previousCwd)
    delete require.cache[runtimePath]
    delete require.cache[indexPath]
    delete require.cache[orchestratorPath]
  }
})
