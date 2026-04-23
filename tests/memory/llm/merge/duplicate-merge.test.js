'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { mergeDuplicateGroup } = require('../../../../src/core/memory/extractors/llm/merge/merge-duplicate-group')
const { buildCandidate } = require('../helpers')

test('mergeDuplicateGroup unions tags and preserves source references', () => {
  const merged = mergeDuplicateGroup([
    buildCandidate({
      candidateId: 'c1',
      tags: ['а', 'б'],
      importance: 'средняя'
    }),
    buildCandidate({
      candidateId: 'c2',
      tags: ['б', 'в'],
      importance: 'высокая'
    })
  ])

  assert.deepEqual(merged.tags, ['а', 'б', 'в'])
  assert.deepEqual(merged.sourceCandidateIds, ['c1', 'c2'])
  assert.equal(merged.importance, 'высокая')
})
