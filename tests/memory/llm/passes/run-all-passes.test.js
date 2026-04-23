'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { runAllExtractorPasses } = require('../../../../src/core/memory/extractors/llm/shared/run-all-passes')
const { buildEvent } = require('../helpers')

test('runAllExtractorPasses keeps successful results when one pass fails', async () => {
  const result = await runAllExtractorPasses({
    passes: [
      {
        extractorKey: 'fact',
        extractorName: 'Fact',
        role: 'fact',
        execute: async () => ({
          extractorKey: 'fact',
          extractorName: 'Fact',
          status: 'success',
          candidates: [{ candidateId: 'c1' }]
        })
      },
      {
        extractorKey: 'episode',
        extractorName: 'Episode',
        role: 'episode',
        execute: async () => {
          throw new Error('episode_failed')
        }
      }
    ],
    event: buildEvent()
  })

  assert.equal(result.total, 2)
  assert.equal(result.successful.length, 1)
  assert.equal(result.failed.length, 1)
  assert.equal(result.partialFailure, true)
})
