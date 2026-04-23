'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizePayload } = require('../../../../src/core/memory/extractors/llm/normalization/normalize-payload')

test('normalizePayload safely normalizes null, object and unstable scalar shapes', () => {
  assert.deepEqual(normalizePayload({ payload: null }).normalizedValue, {})
  assert.deepEqual(normalizePayload({}).normalizedValue, {})
  assert.deepEqual(normalizePayload({ payload: { a: '  x  ' } }).normalizedValue, { a: 'x' })

  const scalar = normalizePayload({ payload: 42 })
  assert.deepEqual(scalar.normalizedValue, { value: 42 })
  assert.ok(scalar.flags.includes('payload_unstable'))
})
