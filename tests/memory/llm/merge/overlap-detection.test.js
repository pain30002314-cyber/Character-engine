'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  findOverlaps,
  scoreCandidateOverlap
} = require('../../../../src/core/memory/extractors/llm/merge/find-overlaps')
const { buildCandidate } = require('../helpers')

test('findOverlaps detects episode and phase overlap on the same fragment', () => {
  const overlaps = findOverlaps({
    candidates: [
      buildCandidate({
        candidateId: 'episode-1',
        kind: 'episode_candidate',
        sourcePass: 'episode',
        text: 'за 4 дня построить базовую память',
        summary: 'надо построить базовую память за 4 дня',
        tags: ['память', 'дедлайн', 'проект']
      }),
      buildCandidate({
        candidateId: 'open-loop-1',
        kind: 'open_loop_candidate',
        sourcePass: 'phase-open-loop',
        text: 'осталось за 4 дня построить базовую память',
        summary: 'еще осталось сделать базовую память',
        tags: ['память', 'дедлайн', 'следующий шаг']
      })
    ]
  })

  assert.equal(overlaps.length, 1)
  assert.equal(overlaps[0].reason, 'mixed_overlap')
  assert.deepEqual(overlaps[0].candidateIds, ['episode-1', 'open-loop-1'])
  assert.ok(overlaps[0].score >= 0.45)
})

test('scoreCandidateOverlap detects episode and significance overlap by summary', () => {
  const score = scoreCandidateOverlap(
    buildCandidate({
      candidateId: 'episode-2',
      kind: 'episode_candidate',
      sourcePass: 'episode',
      eventId: 'evt-3',
      summary: 'запустили пайплайн и увидели логи, это была значимая точка',
      text: 'мы запустили пайплайн и увидели логи',
      tags: ['пайплайн', 'логи']
    }),
    buildCandidate({
      candidateId: 'significance-1',
      kind: 'significance_candidate',
      sourcePass: 'emotion-atmosphere-significance',
      eventId: 'evt-3',
      summary: 'запустили пайплайн, увидели логи и поняли что это была значимая точка',
      text: 'запуск пайплайна оказался значимой точкой',
      tags: ['пайплайн', 'значимость']
    })
  )

  assert.equal(score.isOverlap, true)
  assert.ok(score.reasons.includes('summary_jaccard'))
  assert.ok(score.score >= 0.45)
})

test('findOverlaps skips unrelated candidates from different events', () => {
  const overlaps = findOverlaps({
    candidates: [
      buildCandidate({
        candidateId: 'episode-3',
        kind: 'episode_candidate',
        sourcePass: 'episode',
        eventId: 'evt-1',
        text: 'мы починили merge слой',
        summary: 'починили merge',
        tags: ['merge']
      }),
      buildCandidate({
        candidateId: 'emotion-2',
        kind: 'emotional_state_candidate',
        sourcePass: 'emotion-atmosphere-significance',
        eventId: 'evt-2',
        text: 'я устал после прогулки',
        summary: 'устал после прогулки',
        tags: ['усталость']
      })
    ]
  })

  assert.equal(overlaps.length, 0)
})

test('scoreCandidateOverlap does not mark same-kind candidates as overlap', () => {
  const score = scoreCandidateOverlap(
    buildCandidate({
      candidateId: 'episode-4',
      kind: 'episode_candidate',
      sourcePass: 'episode',
      text: 'мы запустили пайплайн и проверили логи',
      summary: 'запуск пайплайна'
    }),
    buildCandidate({
      candidateId: 'episode-5',
      kind: 'episode_candidate',
      sourcePass: 'episode',
      text: 'мы запустили пайплайн и проверили логи',
      summary: 'проверка логов после запуска'
    })
  )

  assert.equal(score.isOverlap, false)
  assert.ok(score.reasons.includes('same_kind'))
})

test('single shared tag without text overlap stays below threshold', () => {
  const score = scoreCandidateOverlap(
    buildCandidate({
      candidateId: 'episode-6',
      kind: 'episode_candidate',
      sourcePass: 'episode',
      text: 'мы внезапно остановили релиз',
      summary: 'остановили релиз',
      tags: ['проект']
    }),
    buildCandidate({
      candidateId: 'relationship-1',
      kind: 'relationship_candidate',
      sourcePass: 'relationship-social',
      text: 'мы стали доверять друг другу сильнее',
      summary: 'отношения стали теплее',
      tags: ['проект']
    })
  )

  assert.equal(score.isOverlap, false)
  assert.ok(score.score < 0.45)
})
