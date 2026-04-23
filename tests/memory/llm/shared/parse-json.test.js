'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { parseJson } = require('../../../../src/core/memory/extractors/llm/shared/parse-json')

test('parseJson parses valid root object', () => {
  const result = parseJson('  { "candidates": [] }  ')

  assert.equal(result.ok, true)
  assert.deepEqual(result.value, { candidates: [] })
})

test('parseJson returns controlled failure for invalid json', () => {
  const result = parseJson('{invalid')

  assert.equal(result.ok, false)
  assert.equal(result.value, null)
  assert.ok(result.error)
})
