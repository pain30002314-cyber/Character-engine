'use strict'

const TYPE_BASELINES = {
  identity: { importance: 0.92, stability: 0.9, relevance: 0.95, governance: 'high' },
  relationship: { importance: 0.9, stability: 0.78, relevance: 0.9, governance: 'high' },
  preference: { importance: 0.78, stability: 0.75, relevance: 0.8, governance: 'medium' },
  intent: { importance: 0.72, stability: 0.45, relevance: 0.78, governance: 'medium' },
  commitment: { importance: 0.9, stability: 0.84, relevance: 0.91, governance: 'high' },
  open_loop: { importance: 0.76, stability: 0.38, relevance: 0.8, governance: 'medium' },
  conflict: { importance: 0.81, stability: 0.52, relevance: 0.82, governance: 'high' },
  affect: { importance: 0.68, stability: 0.3, relevance: 0.73, governance: 'medium' },
  fact: { importance: 0.8, stability: 0.86, relevance: 0.84, governance: 'high' },
  entity: { importance: 0.65, stability: 0.72, relevance: 0.7, governance: 'medium' },
  action: { importance: 0.44, stability: 0.22, relevance: 0.46, governance: 'disposable' },
  scene: { importance: 0.52, stability: 0.25, relevance: 0.58, governance: 'medium' },
  temporal: { importance: 0.58, stability: 0.28, relevance: 0.61, governance: 'medium' },
  episode: { importance: 0.83, stability: 0.67, relevance: 0.84, governance: 'high' },
  goal: { importance: 0.88, stability: 0.78, relevance: 0.9, governance: 'high' },
  instruction: { importance: 0.72, stability: 0.48, relevance: 0.81, governance: 'medium' },
  boundary: { importance: 0.86, stability: 0.63, relevance: 0.87, governance: 'high' }
}

function clamp(value) {
  return Math.max(0, Math.min(1, value))
}

function scoreHints(candidate) {
  const base = TYPE_BASELINES[candidate.type] || {
    importance: 0.5,
    stability: 0.5,
    relevance: 0.5,
    governance: 'medium'
  }

  const confidence = clamp(candidate.confidence ?? 0.7)
  const ambiguity = clamp(candidate.ambiguity ?? (1 - confidence) * 0.5)

  return {
    confidence,
    importanceHint: clamp(candidate.importanceHint ?? base.importance),
    stabilityHint: clamp(candidate.stabilityHint ?? base.stability),
    ambiguity,
    memoryRelevanceHint: clamp(candidate.memoryRelevanceHint ?? base.relevance),
    governanceHint: candidate.governanceHint || base.governance
  }
}

module.exports = {
  scoreHints,
  clamp
}