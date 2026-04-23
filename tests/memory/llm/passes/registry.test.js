'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getRegisteredExtractorPasses,
  getExtractorPassByKey
} = require('../../../../src/core/memory/extractors/llm/passes/registry')

test('registry exposes seven ordered extractor passes', () => {
  const passes = getRegisteredExtractorPasses()

  assert.equal(passes.length, 7)
  assert.deepEqual(
    passes.map((item) => item.extractorKey),
    [
      'entity-object-location',
      'fact',
      'episode',
      'phase-open-loop',
      'cognition-realization',
      'emotion-atmosphere-significance',
      'relationship-social'
    ]
  )
})

test('getExtractorPassByKey resolves one pass or null', () => {
  assert.equal(getExtractorPassByKey('fact').extractorKey, 'fact')
  assert.equal(getExtractorPassByKey('missing'), null)
})
