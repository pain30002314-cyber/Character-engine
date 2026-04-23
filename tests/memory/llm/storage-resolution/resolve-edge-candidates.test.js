'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveEdgeCandidates } = require('../../../../src/core/memory/extractors/llm/storage-resolution/resolve-edge-candidates')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('resolveEdgeCandidates maps relationship signal into edge resolution', () => {
  const result = resolveEdgeCandidates(
    buildCandidatePool({
      candidates: [
        buildCandidate({
          kind: 'relationship_signal',
          sourcePass: 'relationship-social',
          routingTargets: ['edge_resolution'],
          payload: {
            from: 'Ху Тао',
            to: 'Пользователь',
            relation: 'support'
          }
        })
      ]
    })
  )

  assert.equal(result[0].edgeType, 'relationship')
  assert.deepEqual(result[0].fromNodeHints, ['Ху Тао'])
})
