'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { classifyFailure } = require('../../../../src/core/memory/extractors/llm/failure/classify-failure')

test('classifyFailure distinguishes empty result, partial success and llm failure', () => {
  assert.equal(
    classifyFailure({
      validation: {
        ok: true,
        stats: {
          parsedCandidateCount: 0
        }
      }
    }).type,
    'empty_result'
  )

  assert.equal(
    classifyFailure({
      validation: {
        ok: true,
        stats: {
          parsedCandidateCount: 2,
          validCandidateCount: 1,
          droppedCandidateCount: 1
        }
      }
    }).type,
    'partial_success'
  )

  assert.equal(
    classifyFailure({
      error: {
        code: 'ETIMEDOUT',
        message: 'request timeout'
      }
    }).type,
    'llm_call_failure'
  )
})
