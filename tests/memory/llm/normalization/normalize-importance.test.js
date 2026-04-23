'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeImportance } = require('../../../../src/core/memory/extractors/llm/normalization/normalize-importance')

test('normalizeImportance keeps stable labels and preserves unstable raw values', () => {
  assert.equal(normalizeImportance({ importance: 'низкая' }).normalizedValue, 'низкая')
  assert.equal(normalizeImportance({ importance: 'средняя' }).normalizedValue, 'средняя')
  assert.equal(normalizeImportance({ importance: 'высокая' }).normalizedValue, 'высокая')

  const unstable = normalizeImportance({ importance: 'очень важная' })
  assert.equal(unstable.normalizedValue, null)
  assert.ok(unstable.flags.includes('importance_unstable_raw'))
})
