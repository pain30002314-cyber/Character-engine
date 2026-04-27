'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { triageCandidatePool } = require('../../../../src/core/memory/extractors/llm/lifecycle/triage-candidate-pool')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('triageCandidatePool assigns multiple routing targets when candidate supports it', () => {
  const result = triageCandidatePool(
    buildCandidatePool({
      candidates: [
        buildCandidate({
          kind: 'relationship_candidate',
          sourcePass: 'relationship-social'
        })
      ]
    })
  )

  assert.equal(result.candidates[0].lifecycleStatus, 'triaged')
  assert.ok(result.candidates[0].routingTargets.includes('edge_resolution'))
  assert.ok(result.candidates[0].routingTargets.includes('derived_input'))
})
