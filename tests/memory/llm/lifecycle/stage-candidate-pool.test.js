'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { stageCandidatePool } = require('../../../../src/core/memory/extractors/llm/lifecycle/stage-candidate-pool')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('stageCandidatePool stages valid candidates by default', () => {
  const result = stageCandidatePool(
    buildCandidatePool({
      candidates: [buildCandidate()]
    })
  )

  assert.equal(result.candidates[0].lifecycleStatus, 'staged')
  assert.equal(result.lifecycle.stage.stagedCandidateCount, 1)
})

test('stageCandidatePool discards obvious garbage only', () => {
  const result = stageCandidatePool(
    buildCandidatePool({
      candidates: [{}]
    })
  )

  assert.equal(result.candidates[0].lifecycleStatus, 'discarded')
})
