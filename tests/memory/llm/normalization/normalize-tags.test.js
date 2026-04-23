'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeTags } = require('../../../../src/core/memory/extractors/llm/normalization/normalize-tags')

test('normalizeTags keeps Russian tags, removes empties and exact duplicates', () => {
  const result = normalizeTags({
    tags: ['Ху Тао', 'ху тао', '', 'важный факт', 'важный факт']
  })

  assert.deepEqual(result.normalizedValue, ['ху тао', 'важный факт'])
  assert.equal(result.sourceValue[0], 'Ху Тао')
})
