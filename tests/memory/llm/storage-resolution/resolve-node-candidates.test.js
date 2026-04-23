'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveNodeCandidates } = require('../../../../src/core/memory/extractors/llm/storage-resolution/resolve-node-candidates')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('resolveNodeCandidates maps entity candidate into node resolution', () => {
  const result = resolveNodeCandidates(
    buildCandidatePool({
      candidates: [
        buildCandidate({
          kind: 'entity_candidate',
          sourcePass: 'entity-object-location',
          routingTargets: ['node_resolution'],
          payload: {
            name: 'Ху Тао'
          }
        })
      ]
    })
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].nodeType, 'entity')
  assert.equal(result[0].displayNameSeed, 'Ху Тао')
})
