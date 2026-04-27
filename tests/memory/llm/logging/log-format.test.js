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
    const { logNormalization } = freshRequire('src/core/memory/extractors/llm/logging/log-normalization.js')
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
    await logNormalization({
      traceId: 'trace-1',
      eventId: 'evt-1',
      threadId: 'thread-1',
      sourcePass: 'fact',
      extractorName: 'Fact',
      inputCandidateCount: 1,
      outputCandidateCount: 1,
      unknownKinds: ['unknown_kind'],
      fallbackKindCount: 1,
      kindFallbackPreview: [
        {
          candidateId: 'cand-1',
          sourcePass: 'fact',
          rawKind: 'episode_candidate',
          fallbackKind: 'fact_candidate'
        }
      ],
      unstableImportanceCount: 1,
      cleanedTagsCount: 1,
      payloadUnstableCount: 1,
      inputCandidates: [
        {
          candidateId: 'cand-1',
          kind: 'сырой_факт',
          importance: 'важненько',
          tags: ['tag-a'],
          payload: { subject: 'x' }
        }
      ],
      outputCandidates: [
        {
          candidateId: 'cand-1',
          kind: 'fact',
          importance: 'средняя',
          tags: ['tag-a'],
          payload: { subject: 'x' },
          normalization: {
            changedFields: ['kind', 'importance']
          }
        }
      ]
    })
    await logMerge({
      traceId: 'trace-1',
      eventId: 'evt-1',
      threadId: 'thread-1',
      status: 'completed',
      totalInputCandidates: 3,
      totalOutputCandidates: 2,
      duplicateGroups: 1,
      overlapGroups: 1,
      conflictGroups: 1,
      duplicateGroupPreview: [{ candidateIds: ['cand-1', 'cand-2'] }],
      overlapGroupPreview: [{ reason: 'mixed_overlap', candidateIds: ['cand-1', 'cand-3'] }],
      conflictGroupPreview: [{ relation: 'conflicts_with', candidateIds: ['cand-2', 'cand-4'] }],
      mergeActionsPreview: [{ action: 'link_overlap', candidateIds: ['cand-1', 'cand-3'] }]
    })
    await writeFailureLog({
      traceId: 'trace-1',
      eventId: 'evt-1',
      threadId: 'thread-1',
      failedStage: 'fact',
      error: new Error('boom')
    })

    const extractorLog = fs.readFileSync('logs/memory/extractor-fact.jsonl', 'utf8').trim().split('\n').map(JSON.parse)
    const normalizationLog = fs.readFileSync('logs/memory/normalization.jsonl', 'utf8').trim().split('\n').map(JSON.parse)
    const mergeLog = fs.readFileSync('logs/memory/merge.jsonl', 'utf8').trim().split('\n').map(JSON.parse)
    const failureLog = fs.readFileSync('logs/memory/failures.jsonl', 'utf8').trim().split('\n').map(JSON.parse)

    assert.equal(typeof extractorLog[0].rawResponseText, 'string')
    assert.equal(extractorLog[0].stage, 'extractor')
    assert.equal(typeof extractorLog[0].logVersion, 'string')
    assert.equal(Array.isArray(extractorLog[0].warnings), true)
    assert.equal(Array.isArray(extractorLog[0].errors), true)
    assert.equal(extractorLog[0].counts.parsedCandidateCount, 0)
    assert.equal(extractorLog[0].counts.validCandidateCount, 0)
    assert.equal(extractorLog[0].counts.droppedCandidateCount, 0)
    assert.equal(normalizationLog[0].inputCandidateCount, 1)
    assert.equal(normalizationLog[0].outputCandidateCount, 1)
    assert.deepEqual(normalizationLog[0].unknownKinds, ['unknown_kind'])
    assert.equal(normalizationLog[0].counts.fallbackKindCount, 1)
    assert.equal(normalizationLog[0].kindFallbackPreview[0].fallbackKind, 'fact_candidate')
    assert.equal(normalizationLog[0].candidateDiffPreview[0].candidateId, 'cand-1')
    assert.equal(
      normalizationLog[0].rawImportanceNormalizedImportancePreview[0].rawImportance,
      'важненько'
    )
    assert.equal(
      normalizationLog[0].rawImportanceNormalizedImportancePreview[0].normalizedImportance,
      'средняя'
    )
    assert.equal(mergeLog[0].counts.totalInputCandidates, 3)
    assert.equal(mergeLog[0].counts.overlapGroups, 1)
    assert.equal(mergeLog[0].overlapGroupPreview[0].reason, 'mixed_overlap')
    assert.equal(mergeLog[0].mergeActionsPreview.length, 1)
    assert.equal(failureLog[0].failedStage, 'fact')
  } finally {
    process.chdir(previousCwd)
  }
})
