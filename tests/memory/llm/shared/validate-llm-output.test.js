'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { validateLlmOutput } = require('../../../../src/core/memory/extractors/llm/shared/validate-llm-output')

test('validateLlmOutput accepts empty candidates array', () => {
  const result = validateLlmOutput({
    candidates: []
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 'success')
  assert.equal(result.validCandidates.length, 0)
})

test('validateLlmOutput keeps valid candidates and drops invalid ones', () => {
  const result = validateLlmOutput({
    candidates: [
      {
        kind: 'факт',
        text: 'пример',
        summary: 'пример смысла',
        importance: 'средняя',
        tags: ['пример'],
        payload: {}
      },
      {
        kind: 'факт',
        text: '',
        summary: 'сломано',
        payload: {}
      }
    ]
  })

  assert.equal(result.ok, true)
  assert.equal(result.status, 'partial')
  assert.equal(result.validCandidates.length, 1)
  assert.equal(result.droppedCandidates.length, 1)
})

test('validateLlmOutput rejects broken root shape', () => {
  const missing = validateLlmOutput({})
  const badArray = validateLlmOutput({ candidates: {} })

  assert.equal(missing.ok, false)
  assert.deepEqual(missing.errors, ['candidates_field_missing'])
  assert.equal(badArray.ok, false)
  assert.deepEqual(badArray.errors, ['candidates_field_is_not_array'])
})
