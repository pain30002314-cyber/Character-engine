'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { mergePassResults } = require('../../../../src/core/memory/extractors/llm/merge/merge-pass-results')
const { buildCandidate } = require('../helpers')

test('mergePassResults merges duplicates and keeps missing pass metadata', () => {
  const result = mergePassResults({
    traceId: 'trace-1',
    eventId: 'evt-1',
    threadId: 'thread-1',
    passResults: [
      {
        sourcePass: 'fact',
        candidates: [
          buildCandidate({
            candidateId: 'a',
            text: 'Ху Тао серьезна',
            summary: 'Ху Тао серьезна',
            sourcePass: 'fact'
          }),
          buildCandidate({
            candidateId: 'b',
            text: 'Ху Тао серьезна',
            summary: 'Ху Тао серьезна',
            sourcePass: 'episode',
            tags: ['ху тао', 'тон']
          })
        ]
      }
    ],
    configuredPasses: [{ extractorKey: 'fact' }, { extractorKey: 'episode' }, { extractorKey: 'relationship-social' }],
    failedPasses: [{ extractorKey: 'relationship-social' }]
  })

  assert.equal(result.candidates.length, 1)
  assert.equal(result.mergeMeta.duplicateGroups, 1)
  assert.deepEqual(result.mergeMeta.missingPasses, ['episode', 'relationship-social'])
})
