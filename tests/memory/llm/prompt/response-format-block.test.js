'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  renderResponseFormatBlock
} = require('../../../../src/core/memory/extractors/llm/prompts/blocks/response-format.block')

test('renderResponseFormatBlock uses string importance in the example', () => {
  const block = renderResponseFormatBlock()

  assert.equal(block.includes('"importance": 0.74'), false)
  assert.match(block, /"importance": "средняя"/)
})

test('renderResponseFormatBlock includes allowed kind constraints', () => {
  const block = renderResponseFormatBlock()

  assert.match(block, /kind должен быть только из блока "Допустимые kind"/)
  assert.match(block, /Не придумывай kind\./)
  assert.match(block, /Если сигналов нет, верни \{"candidates":\[\]\}\./)
})
