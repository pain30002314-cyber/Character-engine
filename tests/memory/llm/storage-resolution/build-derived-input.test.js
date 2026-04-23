'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildDerivedInput } = require('../../../../src/core/memory/extractors/llm/storage-resolution/build-derived-input')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('buildDerivedInput maps emotional and relationship signals into derived input', () => {
  const result = buildDerivedInput(
    buildCandidatePool({
      candidates: [
        buildCandidate({
          kind: 'emotional_state',
          routingTargets: ['derived_input'],
          payload: {
            mood: 'тревога'
          }
        }),
        buildCandidate({
          candidateId: 'rel-1',
          kind: 'relationship_signal',
          routingTargets: ['derived_input'],
          payload: {
            entity: 'Ху Тао'
          }
        })
      ]
    })
  )

  assert.equal(result.length, 2)
  assert.equal(result[0].derivedType, 'episode_emotional_trace')
  assert.equal(result[1].derivedType, 'relationship_brief')
})
