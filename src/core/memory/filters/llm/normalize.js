'use strict'

const {
  LEVEL_VALUES,
  ROUTING_DECISIONS,
  MEMORY_CLASSES,
  PRIORITY_VALUES,
  PROMOTION_MODES,
  SAFE_DEFAULTS
} = require('./constants')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function pickEnum(value, allowedSet, fallback, notes, fieldName) {
  const normalized = String(value || '').trim()

  if (allowedSet.has(normalized)) {
    return normalized
  }

  if (notes && fieldName) {
    notes.push(`invalid_${fieldName}`)
  }

  return fallback
}

function normalizeReasonCode(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')

  return normalized || null
}

function sanitizeReasonCodes(value, notes) {
  const codes = safeArray(value)
    .map((item) => normalizeReasonCode(item))
    .filter(Boolean)

  const unique = [...new Set(codes)]

  if (unique.length > 0) {
    return unique
  }

  if (value !== undefined) {
    notes.push('invalid_reason_codes')
  }

  return [...SAFE_DEFAULTS.routing.reason_codes]
}

function sanitizeFilter(filter, notes) {
  const source = filter && typeof filter === 'object' ? filter : {}

  return {
    is_noise:
      typeof source.is_noise === 'boolean'
        ? source.is_noise
        : SAFE_DEFAULTS.filter.is_noise,
    groundedness: pickEnum(
      source.groundedness,
      LEVEL_VALUES,
      SAFE_DEFAULTS.filter.groundedness,
      notes,
      'groundedness'
    ),
    future_utility: pickEnum(
      source.future_utility,
      LEVEL_VALUES,
      SAFE_DEFAULTS.filter.future_utility,
      notes,
      'future_utility'
    ),
    stability: pickEnum(
      source.stability,
      LEVEL_VALUES,
      SAFE_DEFAULTS.filter.stability,
      notes,
      'stability'
    ),
    ambiguity: pickEnum(
      source.ambiguity,
      LEVEL_VALUES,
      SAFE_DEFAULTS.filter.ambiguity,
      notes,
      'ambiguity'
    )
  }
}

function sanitizeRouting(routing, notes) {
  const source = routing && typeof routing === 'object' ? routing : {}

  return {
    decision: pickEnum(
      source.decision,
      ROUTING_DECISIONS,
      SAFE_DEFAULTS.routing.decision,
      notes,
      'decision'
    ),
    reason_codes: sanitizeReasonCodes(source.reason_codes, notes)
  }
}

function sanitizeMemoryProposal(memoryProposal, notes) {
  const source =
    memoryProposal && typeof memoryProposal === 'object' ? memoryProposal : {}

  return {
    class: pickEnum(
      source.class,
      MEMORY_CLASSES,
      SAFE_DEFAULTS.memory_proposal.class,
      notes,
      'class'
    ),
    priority: pickEnum(
      source.priority,
      PRIORITY_VALUES,
      SAFE_DEFAULTS.memory_proposal.priority,
      notes,
      'priority'
    ),
    promotion_mode: pickEnum(
      source.promotion_mode,
      PROMOTION_MODES,
      SAFE_DEFAULTS.memory_proposal.promotion_mode,
      notes,
      'promotion_mode'
    )
  }
}

function parseFilterEvaluatorResponse(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return {
      parsed: null,
      evaluations: [],
      parseError: 'empty_response'
    }
  }

  try {
    const parsed = JSON.parse(rawContent)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        parsed,
        evaluations: [],
        parseError: 'root_object_required'
      }
    }

    if (!Array.isArray(parsed.evaluations)) {
      return {
        parsed,
        evaluations: [],
        parseError: 'evaluations_array_required'
      }
    }

    return {
      parsed,
      evaluations: parsed.evaluations,
      parseError: null
    }
  } catch (error) {
    return {
      parsed: null,
      evaluations: [],
      parseError: error.message || 'invalid_json'
    }
  }
}

function extractEvaluationId(evaluation) {
  if (!evaluation || typeof evaluation !== 'object') {
    return null
  }

  const rawId = evaluation.candidate_id || evaluation.candidateId || evaluation.id
  const normalized = String(rawId || '').trim()

  return normalized || null
}

function buildEvaluationMatcher(evaluations, candidates) {
  const byId = new Map()
  const byIndex = new Map()

  safeArray(evaluations).forEach((evaluation, index) => {
    byIndex.set(index, evaluation)

    const candidateId = extractEvaluationId(evaluation)
    if (candidateId) {
      byId.set(candidateId, evaluation)
    }
  })

  return function match(candidate, index) {
    const candidateId = String(candidate?.id || '').trim()

    if (candidateId && byId.has(candidateId)) {
      return {
        evaluation: byId.get(candidateId),
        matchedBy: 'candidate_id'
      }
    }

    if (byIndex.has(index) && !byId.has(candidateId)) {
      return {
        evaluation: byIndex.get(index),
        matchedBy: 'index'
      }
    }

    return {
      evaluation: null,
      matchedBy: null
    }
  }
}

function buildFilterDebug({
  evaluation,
  matchedBy,
  notes,
  parseError
}) {
  if (parseError) {
    return {
      status: 'parse_error',
      parse_error: parseError,
      matched_by: matchedBy,
      fallback_used: true,
      sanitization_notes: notes
    }
  }

  if (!evaluation) {
    return {
      status: 'missing_evaluation',
      matched_by: matchedBy,
      fallback_used: true,
      sanitization_notes: notes
    }
  }

  if (notes.length > 0) {
    return {
      status: 'sanitized',
      matched_by: matchedBy,
      fallback_used: true,
      sanitization_notes: notes
    }
  }

  return {
    status: 'ok',
    matched_by: matchedBy,
    fallback_used: false
  }
}

function enrichCandidatesWithFilterEvaluations(candidates, evaluations, options = {}) {
  const matcher = buildEvaluationMatcher(evaluations, candidates)
  const parseError = options.parseError || null

  return safeArray(candidates).map((candidate, index) => {
    const { evaluation, matchedBy } = matcher(candidate, index)
    const notes = []

    const filter = sanitizeFilter(evaluation?.filter, notes)
    const routing = sanitizeRouting(evaluation?.routing, notes)
    const memoryProposal = sanitizeMemoryProposal(evaluation?.memory_proposal, notes)

    if (!evaluation) {
      notes.push('used_safe_defaults')
    }

    return {
      ...candidate,
      filter,
      routing,
      memory_proposal: memoryProposal,
      filter_debug: buildFilterDebug({
        evaluation,
        matchedBy,
        notes,
        parseError
      })
    }
  })
}

function buildBatchSummary(candidates) {
  const summary = {
    total_candidates: safeArray(candidates).length,
    drop: 0,
    stage_candidate: 0,
    episodic_candidate: 0,
    semantic_fact_candidate: 0,
    fast_track_canonical: 0
  }

  safeArray(candidates).forEach((candidate) => {
    const decision = candidate?.routing?.decision

    if (decision && Object.prototype.hasOwnProperty.call(summary, decision)) {
      summary[decision] += 1
    }
  })

  return summary
}

module.exports = {
  parseFilterEvaluatorResponse,
  enrichCandidatesWithFilterEvaluations,
  buildBatchSummary
}
