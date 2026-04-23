'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildPartialPassResult } = require('../../../../src/core/memory/extractors/llm/failure/build-partial-pass-result')
const { buildEvent, buildPass } = require('../helpers')

test('buildPartialPassResult keeps valid candidates and marks pass as partial', () => {
  const result = buildPartialPassResult({
    pass: buildPass(),
    event: buildEvent(),
    traceId: 'trace-1',
    candidates: [{ candidateId: 'c1' }],
    validation: {
      stats: {
        parsedCandidateCount: 2,
        validCandidateCount: 1,
        droppedCandidateCount: 1
      }
    }
  })

  assert.equal(result.status, 'partial')
  assert.equal(result.candidates.length, 1)
  assert.equal(result.failure.type, 'partial_success')
})
