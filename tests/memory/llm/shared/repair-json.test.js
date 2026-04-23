'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { repairJson } = require('../../../../src/core/memory/extractors/llm/shared/repair-json')

test('repairJson handles fenced json, leading text, trailing text and trailing commas', () => {
  const result = repairJson('Ответ:\n```json\n{ "candidates": [{ "kind": "факт", "text": "пример", "summary": "пример", "payload": {}, }], }\n```\nготово')

  assert.equal(result.ok, true)
  assert.equal(result.strategy, 'strip_trailing_commas')
  assert.deepEqual(result.value.candidates[0].kind, 'факт')
})

test('repairJson handles markdown fences without json label', () => {
  const result = repairJson('```\n{"candidates":[]}\n```')

  assert.equal(result.ok, true)
  assert.equal(result.value.candidates.length, 0)
})

test('repairJson returns controlled failure for unrecoverable text', () => {
  const result = repairJson('совсем не json и не похоже на него')

  assert.equal(result.ok, false)
  assert.equal(result.error, 'json_repair_failed')
})
