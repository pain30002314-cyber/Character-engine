'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { shouldRetry } = require('../../../../src/core/memory/extractors/llm/failure/should-retry')

test('shouldRetry allows retry for timeout and 5xx llm transport failures only', () => {
  const timeout = shouldRetry({
    failureType: 'llm_call_failure',
    error: { code: 'ETIMEDOUT', message: 'timed out' },
    retryCount: 0
  })
  const validLowQuality = shouldRetry({
    failureType: 'partial_success',
    error: null,
    retryCount: 0
  })

  assert.equal(timeout.retry, true)
  assert.equal(validLowQuality.retry, false)
})
