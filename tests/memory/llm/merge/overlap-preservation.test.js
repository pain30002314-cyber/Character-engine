'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { mergePassResults } = require('../../../../src/core/memory/extractors/llm/merge/merge-pass-results')
const { buildCandidate } = require('../helpers')

test('merge keeps different kinds on same fragment and marks overlap', () => {
  const result = mergePassResults({
    passResults: [
      {
        sourcePass: 'mixed',
        candidates: [
          buildCandidate({
            candidateId: 'fact-1',
            kind: 'episode_candidate',
            sourcePass: 'episode',
            text: 'за 4 дня построить базовую память',
            summary: 'строим базовую память за 4 дня',
            tags: ['память', 'дедлайн']
          }),
          buildCandidate({
            candidateId: 'emotion-1',
            kind: 'open_loop_candidate',
            sourcePass: 'phase-open-loop',
            text: 'осталось за 4 дня построить базовую память',
            summary: 'осталось доделать базовую память',
            tags: ['память', 'дедлайн', 'следующий шаг']
          })
        ]
      }
    ]
  })

  assert.equal(result.candidates.length, 2)
  assert.ok(result.candidates.every((item) => item.flags.includes('overlap_detected')))
  assert.equal(result.mergeMeta.overlapGroups, 1)
  assert.equal(result.mergeMeta.overlapGroupPreview[0].reason, 'mixed_overlap')
  assert.ok(result.candidates.every((item) => item.relatedCandidateIds.length === 1))
  assert.ok(
    result.candidates.every((item) =>
      item.relationToRelated.some((relation) =>
        relation.relation === 'overlaps_with' &&
        relation.reason === 'mixed_overlap' &&
        relation.score >= 0.45
      )
    )
  )
})
