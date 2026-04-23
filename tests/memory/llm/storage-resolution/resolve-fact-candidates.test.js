'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveFactCandidates } = require('../../../../src/core/memory/extractors/llm/storage-resolution/resolve-fact-candidates')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('resolveFactCandidates maps fact candidate into fact resolution', () => {
  const result = resolveFactCandidates(
    buildCandidatePool({
      candidates: [
        buildCandidate({
          kind: 'fact_candidate',
          routingTargets: ['fact_resolution'],
          payload: {
            subject: 'Ху Тао',
            predicate: 'likes',
            object: 'чай'
          }
        })
      ]
    })
  )

  assert.equal(result[0].predicateSeed, 'likes')
  assert.equal(result[0].subjectSeed, 'Ху Тао')
})
