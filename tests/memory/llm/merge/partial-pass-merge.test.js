'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { mergePassResults } = require('../../../../src/core/memory/extractors/llm/merge/merge-pass-results')

test('mergePassResults accepts empty pass results and partial pass set', () => {
  const result = mergePassResults({
    configuredPasses: [{ extractorKey: 'fact' }, { extractorKey: 'episode' }],
    passResults: [],
    failedPasses: [{ extractorKey: 'episode' }]
  })

  assert.deepEqual(result.candidates, [])
  assert.deepEqual(result.mergeMeta.missingPasses, ['fact', 'episode'])
  assert.ok(result.mergeMeta.warnings.includes('partial_pass_set'))
})
