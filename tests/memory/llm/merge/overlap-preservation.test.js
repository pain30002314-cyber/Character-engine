'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { mergePassResults } = require('../../../../src/core/memory/extractors/llm/merge/merge-pass-results')
const { buildCandidate } = require('../helpers')

test('merge keeps different kinds on same fragment and marks overlap', () => {
  const result = mergePassResults({
    passResults: [
      {
        sourcePass: 'fact',
        candidates: [
          buildCandidate({
            candidateId: 'fact-1',
            kind: 'fact_candidate',
            text: 'Мне тревожно',
            summary: 'Мне тревожно'
          }),
          buildCandidate({
            candidateId: 'emotion-1',
            kind: 'emotional_state',
            text: 'Мне тревожно',
            summary: 'Мне тревожно'
          })
        ]
      }
    ]
  })

  assert.equal(result.candidates.length, 2)
  assert.ok(result.candidates.every((item) => item.flags.includes('overlap_detected')))
})
