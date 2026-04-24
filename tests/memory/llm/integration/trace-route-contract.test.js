'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { createTempDir, freshRequire, buildEvent } = require('../helpers')

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

test('single traceId reconstructs base packet, seven extractor passes, normalization, merge, and skipped persistence', async () => {
  const previousCwd = process.cwd()
  const tempDir = createTempDir('memory-trace-route-')

  process.chdir(tempDir)

  try {
    const { runExtractFilterObservePipeline } = freshRequire(
      'src/core/memory/pipeline/extract-filter-observe.pipeline.js'
    )
    const { runLlmExtractionRuntime } = freshRequire(
      'src/core/memory/extractors/llm/index.js'
    )
    const event = buildEvent({
      id: 'evt-trace-route-1',
      threadId: 'thread-trace-route-1'
    })
    const traceId = 'trace-route-1'

    const result = await runExtractFilterObservePipeline({
      threadId: event.threadId,
      event,
      extractionConfig: {
        mode: 'llm_only',
        wideLlmExtractorEnabled: true,
        disablePersistenceWrite: true
      },
      runtimeImpl: ({ event: runtimeEvent, eventWindow }) =>
        runLlmExtractionRuntime({
          event: runtimeEvent,
          eventWindow,
          llm: {
            callModel: async () => ({
              rawResponseText: JSON.stringify({
                candidates: []
              }),
              model: 'mock-model'
            })
          },
          runtime: {
            traceId
          }
        })
    })

    const logRoot = path.join(tempDir, 'logs', 'memory')
    const basePacketEntries = readJsonl(path.join(logRoot, 'base-packet.jsonl'))
    const normalizationEntries = readJsonl(path.join(logRoot, 'normalization.jsonl'))
    const mergeEntries = readJsonl(path.join(logRoot, 'merge.jsonl'))
    const persistenceEntries = readJsonl(path.join(logRoot, 'persistence.jsonl'))
    const extractorFiles = [
      'extractor-entity_object_location.jsonl',
      'extractor-fact.jsonl',
      'extractor-episode.jsonl',
      'extractor-phase_open_loop.jsonl',
      'extractor-cognition_realization.jsonl',
      'extractor-emotion_atmosphere_significance.jsonl',
      'extractor-relationship_social.jsonl'
    ]

    const extractorEntries = extractorFiles.flatMap((fileName) =>
      readJsonl(path.join(logRoot, fileName)).filter((entry) => entry.traceId === traceId)
    )

    assert.equal(result.traceId, traceId)
    assert.equal(basePacketEntries.filter((entry) => entry.traceId === traceId).length, 1)
    assert.equal(extractorEntries.length, 7)
    assert.equal(
      extractorEntries.every((entry) => entry.stage === 'extractor'),
      true
    )
    assert.equal(
      normalizationEntries.filter((entry) => entry.traceId === traceId).length,
      7
    )
    assert.equal(mergeEntries.filter((entry) => entry.traceId === traceId).length, 1)
    assert.equal(
      persistenceEntries.some(
        (entry) =>
          entry.traceId === traceId &&
          entry.status === 'skipped' &&
          entry.note === 'persistence_skipped_by_config'
      ),
      true
    )
  } finally {
    process.chdir(previousCwd)
  }
})
