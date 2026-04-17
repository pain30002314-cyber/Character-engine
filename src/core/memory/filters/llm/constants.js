'use strict'

const FILTER_VERSION = 'v1'
const FILTER_STRATEGY = 'llm_candidate_filter_evaluator_v1'

const LEVEL_VALUES = new Set(['low', 'medium', 'high'])
const ROUTING_DECISIONS = new Set([
  'drop',
  'stage_candidate',
  'episodic_candidate',
  'semantic_fact_candidate',
  'fast_track_canonical'
])
const MEMORY_CLASSES = new Set([
  'semantic_fact',
  'episodic',
  'relationship_signal',
  'goal_signal',
  'preference_signal',
  'state_signal',
  'other'
])
const PRIORITY_VALUES = new Set(['low', 'medium', 'high'])
const PROMOTION_MODES = new Set([
  'direct',
  'needs_accumulation',
  'needs_downstream_review'
])

const SAFE_DEFAULTS = {
  filter: {
    is_noise: false,
    groundedness: 'medium',
    future_utility: 'medium',
    stability: 'low',
    ambiguity: 'high'
  },
  routing: {
    decision: 'stage_candidate',
    reason_codes: ['fallback_default']
  },
  memory_proposal: {
    class: 'other',
    priority: 'medium',
    promotion_mode: 'needs_downstream_review'
  }
}

module.exports = {
  FILTER_VERSION,
  FILTER_STRATEGY,
  LEVEL_VALUES,
  ROUTING_DECISIONS,
  MEMORY_CLASSES,
  PRIORITY_VALUES,
  PROMOTION_MODES,
  SAFE_DEFAULTS
}
