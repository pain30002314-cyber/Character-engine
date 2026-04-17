'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  parseFilterEvaluatorResponse,
  enrichCandidatesWithFilterEvaluations,
  buildBatchSummary
} = require('../src/core/memory/filters/llm/normalize')

function buildCandidate(id, text = 'test') {
  return {
    id,
    kind: 'fact',
    text
  }
}

test('parseFilterEvaluatorResponse reads evaluations array from JSON object', () => {
  const raw = JSON.stringify({
    evaluations: [
      {
        candidate_id: 'c1',
        filter: {
          is_noise: false,
          groundedness: 'high',
          future_utility: 'medium',
          stability: 'high',
          ambiguity: 'low'
        },
        routing: {
          decision: 'semantic_fact_candidate',
          reason_codes: ['high_groundedness', 'future_useful']
        },
        memory_proposal: {
          class: 'semantic_fact',
          priority: 'high',
          promotion_mode: 'direct'
        }
      }
    ]
  })

  const result = parseFilterEvaluatorResponse(raw)

  assert.equal(result.parseError, null)
  assert.equal(result.evaluations.length, 1)
  assert.equal(result.evaluations[0].candidate_id, 'c1')
})

test('enrichCandidatesWithFilterEvaluations sanitizes invalid enums and reason codes', () => {
  const candidates = [buildCandidate('c1')]
  const evaluations = [
    {
      candidate_id: 'c1',
      filter: {
        is_noise: 'maybe',
        groundedness: 'extreme',
        future_utility: 'high',
        stability: 'medium',
        ambiguity: 'foggy'
      },
      routing: {
        decision: 'ship_it',
        reason_codes: ['High Groundedness', 'future useful', '']
      },
      memory_proposal: {
        class: 'preference_signal',
        priority: 'urgent',
        promotion_mode: 'direct_now'
      }
    }
  ]

  const result = enrichCandidatesWithFilterEvaluations(candidates, evaluations)
  const candidate = result[0]

  assert.equal(candidate.filter.is_noise, false)
  assert.equal(candidate.filter.groundedness, 'medium')
  assert.equal(candidate.filter.future_utility, 'high')
  assert.equal(candidate.filter.ambiguity, 'high')
  assert.equal(candidate.routing.decision, 'stage_candidate')
  assert.deepEqual(candidate.routing.reason_codes, ['high_groundedness', 'future_useful'])
  assert.equal(candidate.memory_proposal.class, 'preference_signal')
  assert.equal(candidate.memory_proposal.priority, 'medium')
  assert.equal(candidate.memory_proposal.promotion_mode, 'needs_downstream_review')
  assert.equal(candidate.filter_debug.status, 'sanitized')
})

test('enrichCandidatesWithFilterEvaluations falls back safely on parse errors', () => {
  const candidates = [buildCandidate('c1'), buildCandidate('c2')]
  const result = enrichCandidatesWithFilterEvaluations(candidates, [], {
    parseError: 'Unexpected token <'
  })

  assert.equal(result[0].filter.groundedness, 'medium')
  assert.equal(result[0].filter.stability, 'low')
  assert.equal(result[0].routing.decision, 'stage_candidate')
  assert.equal(result[0].memory_proposal.class, 'other')
  assert.equal(result[0].filter_debug.status, 'parse_error')
  assert.equal(result[0].filter_debug.parse_error, 'Unexpected token <')
  assert.equal(result[1].filter_debug.status, 'parse_error')
})

test('buildBatchSummary counts routing decisions from enriched candidates', () => {
  const summary = buildBatchSummary([
    {
      routing: {
        decision: 'drop'
      }
    },
    {
      routing: {
        decision: 'stage_candidate'
      }
    },
    {
      routing: {
        decision: 'stage_candidate'
      }
    },
    {
      routing: {
        decision: 'fast_track_canonical'
      }
    }
  ])

  assert.deepEqual(summary, {
    total_candidates: 4,
    drop: 1,
    stage_candidate: 2,
    episodic_candidate: 0,
    semantic_fact_candidate: 0,
    fast_track_canonical: 1
  })
})

test('parseFilterEvaluatorResponse rejects non-object root shape', () => {
  const raw = JSON.stringify([
    {
      candidate_id: 'c1'
    }
  ])

  const result = parseFilterEvaluatorResponse(raw)

  assert.equal(result.parseError, 'root_object_required')
  assert.deepEqual(result.evaluations, [])
})
