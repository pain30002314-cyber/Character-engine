'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { mergePassResults } = require('../../../../src/core/memory/extractors/llm/merge/merge-pass-results')
const { buildCandidate } = require('../helpers')

test('merge marks conflicting candidates without collapsing them', () => {
  const result = mergePassResults({
    passResults: [
      {
        sourcePass: 'fact',
        candidates: [
          buildCandidate({
            candidateId: 'c1',
            payload: { state: 'open' }
          }),
          buildCandidate({
            candidateId: 'c2',
            payload: { state: 'closed' }
          })
        ]
      }
    ]
  })

  assert.equal(result.candidates.length, 2)
  assert.ok(result.candidates.every((item) => item.flags.includes('conflict_detected')))
  assert.equal(result.mergeMeta.conflictGroups, 1)
})
