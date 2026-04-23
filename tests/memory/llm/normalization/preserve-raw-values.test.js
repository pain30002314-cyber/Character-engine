'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { preserveRawValues } = require('../../../../src/core/memory/extractors/llm/normalization/preserve-raw-values')

test('preserveRawValues keeps changed raw fields without mutating semantic meaning', () => {
  const result = preserveRawValues(
    {
      kind: 'факт'
    },
    [
      {
        field: 'kind',
        rawField: 'rawKind',
        sourceValue: 'ФАКТ',
        normalizedValue: 'fact_candidate',
        forceKeepRaw: true
      }
    ]
  )

  assert.equal(result.candidate.kind, 'fact_candidate')
  assert.equal(result.candidate.rawKind, 'ФАКТ')
  assert.deepEqual(result.changedFields, ['kind'])
})
