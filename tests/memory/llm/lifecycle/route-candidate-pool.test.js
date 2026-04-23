'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { routeCandidatePool } = require('../../../../src/core/memory/extractors/llm/lifecycle/route-candidate-pool')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('routeCandidatePool routes staged candidate groups without destroying candidate', () => {
  const result = routeCandidatePool(
    buildCandidatePool({
      candidates: [
        buildCandidate({
          lifecycleStatus: 'triaged',
          triageTargets: ['fact_resolution', 'edge_resolution']
        })
      ]
    })
  )

  assert.equal(result.candidates[0].lifecycleStatus, 'routed')
  assert.equal(result.routeGroups.fact_resolution.length, 1)
  assert.equal(result.routeGroups.edge_resolution.length, 1)
})
