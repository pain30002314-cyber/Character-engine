'use strict'

const {
  FILTER_VERSION,
  FILTER_STRATEGY
} = require('./constants')

function safeJson(value) {
  return JSON.stringify(value, null, 2)
}

function buildFilterPrompt({ input }) {
  const payload = {
    task: FILTER_STRATEGY,
    version: FILTER_VERSION,
    instructions: {
      role:
        'You are a candidate evaluator for memory-ingestion triage.',
      objective:
        'Evaluate already extracted candidates conservatively and return triage metadata only.',
      strictBoundaries: [
        'You are NOT the memory system.',
        'You are NOT the canonical writer.',
        'You are NOT the conflict resolver.',
        'You are NOT the entity linker.',
        'You are NOT the episode grouper across messages.',
        'Do NOT write memory.',
        'Do NOT resolve contradictions.',
        'Do NOT look up existing memory.',
        'Do NOT invent missing context.',
        'Do NOT reinterpret beyond the source text more than necessary.'
      ],
      evaluationGuidance: [
        'Judge each candidate only as a memory-ingestion candidate.',
        'Use the source text as the main grounding signal.',
        'Be conservative when a candidate is vague, under-supported, fleeting, or heavily contextual.',
        'Prefer stage_candidate when unsure instead of aggressive routing.',
        'Use fast_track_canonical only for highly grounded, stable, and future-useful candidates.',
        'Use drop only when the candidate is mostly noise, duplicate fluff, or clearly not worth memory ingestion.',
        'reason_codes must be short lowercase snake_case strings.',
        'Return one evaluation for every input candidate.'
      ],
      outputRules: [
        'Return JSON only.',
        'Do not add explanations outside JSON.',
        'Do not echo the full input.',
        'Do not omit required nested fields.',
        'If uncertain, still return conservative values rather than leaving fields empty.'
      ]
    },
    outputSchema: {
      evaluations: [
        {
          candidate_id: 'string',
          filter: {
            is_noise: false,
            groundedness: 'low|medium|high',
            future_utility: 'low|medium|high',
            stability: 'low|medium|high',
            ambiguity: 'low|medium|high'
          },
          routing: {
            decision:
              'drop|stage_candidate|episodic_candidate|semantic_fact_candidate|fast_track_canonical',
            reason_codes: ['short_machine_friendly_code']
          },
          memory_proposal: {
            class:
              'semantic_fact|episodic|relationship_signal|goal_signal|preference_signal|state_signal|other',
            priority: 'low|medium|high',
            promotion_mode:
              'direct|needs_accumulation|needs_downstream_review'
          }
        }
      ]
    },
    input
  }

  return safeJson(payload)
}

module.exports = {
  buildFilterPrompt
}
