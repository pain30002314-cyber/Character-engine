'use strict'

const { buildAtomId } = require('../core/ids')
const { scoreHints } = require('../core/scoring')

function toRoleRef(role, surface, confidence = 1) {
  if (!surface && !role) return null

  const ref =
    role === 'user'
      ? 'event_speaker'
      : role === 'assistant'
        ? 'event_addressee'
        : null

  return {
    ref,
    role: role || 'unknown',
    surface: surface || null,
    resolved: false,
    confidence
  }
}

function inferTransience(type) {
  if (['identity', 'fact', 'entity', 'relationship', 'commitment', 'goal', 'boundary'].includes(type)) {
    return 'stable'
  }

  if (['affect', 'action', 'scene', 'temporal'].includes(type)) {
    return 'transient'
  }

  return 'transient'
}

function inferScope(type) {
  if (['identity', 'fact', 'relationship', 'commitment', 'goal', 'boundary'].includes(type)) {
    return 'long_term'
  }

  if (['scene', 'action', 'affect', 'temporal'].includes(type)) {
    return 'scene'
  }

  return 'message'
}

function inferChangeLevel(type) {
  if (type === 'identity') return 'identity'
  if (type === 'relationship') return 'relational'
  if (type === 'commitment') return 'structural'
  if (type === 'fact') return 'state'
  return 'transient'
}

function buildAtom(candidate, event) {
  const scored = scoreHints(candidate)

  return {
    id: buildAtomId(candidate.type, candidate.subtype, event.id, candidate.text),

    type: candidate.type,
    subtype: candidate.subtype || 'generic',

    text: candidate.text,
    unitText: candidate.unitText || candidate.text,
    normalizedText: candidate.normalizedText || String(candidate.text || '').toLowerCase(),

    sourceEventId: event.id,
    timestamp: event.timestamp,

    actor:
      candidate.actor ||
      toRoleRef(event.role, event.role === 'user' ? 'я' : 'я', 1),

    target: candidate.target || null,
    about: candidate.about || [],

    polarity: candidate.polarity || null,
    certainty: candidate.certainty || null,
    tenseHint: candidate.tenseHint || null,
    timeAnchor: candidate.timeAnchor || null,

    negated: Boolean(candidate.negated),
    quoted: Boolean(candidate.quoted),
    reported: Boolean(candidate.reported),
    hypothetical: Boolean(candidate.hypothetical),
    conditional: Boolean(candidate.conditional),
    interrogative: Boolean(candidate.interrogative),
    imperative: Boolean(candidate.imperative),
    hedged: Boolean(candidate.hedged),

    confidence: scored.confidence,
    importanceHint: scored.importanceHint,
    stabilityHint: scored.stabilityHint,
    ambiguity: scored.ambiguity,

    transience: candidate.transience || inferTransience(candidate.type),
    scope: candidate.scope || inferScope(candidate.type),
    changeLevel: candidate.changeLevel || inferChangeLevel(candidate.type),

    governanceHint: scored.governanceHint,
    memoryRelevanceHint: scored.memoryRelevanceHint,

    dedupeKeyHint: candidate.dedupeKeyHint || null,

    source: {
      extractor: candidate.source?.extractor || `${candidate.type}.detector`,
      rule: candidate.source?.rule || 'unknown_rule'
    },

    payload: candidate.payload || {}
  }
}

module.exports = {
  buildAtom,
  toRoleRef
}