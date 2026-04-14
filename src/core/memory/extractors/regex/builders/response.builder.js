'use strict'

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildEvent(event) {
  return {
    id: event?.id || null,
    threadId: event?.threadId || null,
    platform: event?.platform || 'telegram',
    channel: event?.channel || 'text',
    role: event?.role || 'user',
    world: event?.world || 'Earth',
    timestamp: event?.timestamp || null,
    text: event?.text || ''
  }
}

function buildQuestionItem(atom, index) {
  return {
    id: `q${index + 1}`,
    text: atom.text,
    normalizedText: atom.normalizedText || normalizeText(atom.text).toLowerCase(),
    kind: atom.subtype || 'direct_question',
    priority: 'high',
    confidence: atom.confidence || 0.8,
    sourceRule: atom.source?.rule || 'unknown_rule',
    clauseId: atom.payload?.clauseId || null
  }
}

function buildInstructionItem(atom, index) {
  return {
    id: `ins${index + 1}`,
    text: atom.text,
    normalizedText: atom.normalizedText || normalizeText(atom.text).toLowerCase(),
    kind: atom.subtype || 'direct_instruction',
    priority: 'high',
    confidence: atom.confidence || 0.8,
    sourceRule: atom.source?.rule || 'unknown_rule',
    clauseId: atom.payload?.clauseId || null
  }
}

function buildTemporalAnchorItem(atom, index) {
  return {
    id: `tmp${index + 1}`,
    text: atom.text,
    normalizedText: atom.normalizedText || normalizeText(atom.text).toLowerCase(),
    kind: atom.subtype || 'temporal_anchor',
    confidence: atom.confidence || 0.75,
    sourceRule: atom.source?.rule || 'unknown_rule',
    clauseId: atom.payload?.clauseId || null
  }
}

function buildIdentityHintItem(hint, index) {
  return {
    id: hint.id || `idh${index + 1}`,
    kind: hint.kind || 'display_name_candidate',
    value: hint.value || '',
    normalizedValue:
      hint.normalizedValue || normalizeText(hint.value).toLowerCase(),
    confidence: hint.confidence || 0.8,
    sourceRule: hint.source?.rule || 'unknown_rule',
    clauseId: hint.payload?.clauseId || null
  }
}

function buildContextTags(atom) {
  const tags = []

  if (atom.type) tags.push(atom.type)
  if (atom.subtype) tags.push(atom.subtype)
  if (atom.interrogative) tags.push('question_like')
  if (atom.imperative) tags.push('imperative')
  if (atom.quoted) tags.push('quoted')
  if (atom.reported) tags.push('reported')
  if (atom.hypothetical) tags.push('hypothetical')
  if (atom.timeAnchor) tags.push('time_anchor')
  if (atom.type === 'action' && atom.subtype === 'physical') {
    tags.push('physical_contact')
  }

  return Array.from(new Set(tags))
}

function buildContextAtomItem(atom, index) {
  return {
    id: `ctx${index + 1}`,
    type: atom.type,
    subtype: atom.subtype || 'generic',
    text: atom.text,
    normalizedText: atom.normalizedText || normalizeText(atom.text).toLowerCase(),
    confidence: atom.confidence || 0.7,
    sourceRule: atom.source?.rule || 'unknown_rule',
    clauseId: atom.payload?.clauseId || null,
    tags: buildContextTags(atom)
  }
}

function isQuestionAtom(atom) {
  return atom?.type === 'open_loop' && atom?.subtype === 'direct_question'
}

function isInstructionAtom(atom) {
  return atom?.type === 'instruction'
}

function isTemporalAtom(atom) {
  return atom?.type === 'temporal'
}

function isContextAtom(atom) {
  if (!atom?.type) return false
  if (isQuestionAtom(atom)) return false
  if (isInstructionAtom(atom)) return false
  if (isTemporalAtom(atom)) return false
  if (atom.type === 'identity') return false

  return (
    (atom.type === 'action' && atom.subtype !== 'speech') ||
    atom.type === 'scene' ||
    atom.type === 'affect' ||
    atom.type === 'boundary' ||
    atom.type === 'temporal'
  )
}

function buildReplySignals({
  questions,
  instructions,
  temporalAnchors,
  identityHints,
  contextAtoms,
  atoms,
  service
}) {
  const safeAtoms = Array.isArray(atoms) ? atoms : []

  const hasPhysicalContact = safeAtoms.some(
    (atom) => atom.type === 'action' && atom.subtype === 'physical'
  )

  const hasAffect = safeAtoms.some((atom) => atom.type === 'affect')
  const hasSceneSignal = safeAtoms.some((atom) => atom.type === 'scene')
  const hasUnresolvedTopic =
    questions.length > 0 ||
    safeAtoms.some((atom) => atom.type === 'open_loop')

  return {
    hasQuestion: questions.length > 0,
    questionCount: questions.length,

    hasInstruction: instructions.length > 0,
    instructionCount: instructions.length,

    hasTemporalAnchor: temporalAnchors.length > 0,
    temporalAnchorCount: temporalAnchors.length,

    hasIdentityHint: identityHints.length > 0,
    identityHintCount: identityHints.length,

    hasRp: (service?.stats?.rpBlocksCount || 0) > 0,
    rpBlockCount: service?.stats?.rpBlocksCount || 0,

    hasContextAtom: contextAtoms.length > 0,
    contextAtomCount: contextAtoms.length,

    hasPhysicalContact,
    hasAffect,
    hasSceneSignal,
    hasUnresolvedTopic
  }
}

function buildService(service, signals) {
  return {
    extractorVersion: service?.extractorVersion || '2.0.0',
    processedAt: service?.processedAt || new Date().toISOString(),
    durationMs: service?.durationMs || 0,
    stats: {
      rpBlocksCount: service?.stats?.rpBlocksCount || 0,
      unitCount: service?.stats?.unitCount || 0,
      clauseCount: service?.stats?.clauseCount || 0,
      detectorCount: service?.stats?.detectorCount || 0,
      candidatesBeforeFilter: service?.stats?.candidatesBeforeFilter || 0,
      filteredCandidates: service?.stats?.filteredCandidates || 0,
      builtAtoms: service?.stats?.builtAtoms || 0,
      finalQuestions: signals.questions.length,
      finalInstructions: signals.instructions.length,
      finalTemporalAnchors: signals.temporalAnchors.length,
      finalIdentityHints: signals.identityHints.length,
      finalContextAtoms: signals.contextAtoms.length
    },
    warnings: Array.isArray(service?.warnings) ? service.warnings : []
  }
}

function buildResponse({
  event,
  identityHints,
  atoms,
  service
}) {
  const safeAtoms = Array.isArray(atoms) ? atoms : []
  const safeIdentityHints = Array.isArray(identityHints) ? identityHints : []

  const questions = safeAtoms
    .filter(isQuestionAtom)
    .map(buildQuestionItem)

  const instructions = safeAtoms
    .filter(isInstructionAtom)
    .map(buildInstructionItem)

  const temporalAnchors = safeAtoms
    .filter(isTemporalAtom)
    .map(buildTemporalAnchorItem)

  const nextIdentityHints = safeIdentityHints
    .map(buildIdentityHintItem)

  const contextAtoms = safeAtoms
    .filter(isContextAtom)
    .map(buildContextAtomItem)

  const signals = {
    questions,
    instructions,
    temporalAnchors,
    identityHints: nextIdentityHints,
    replySignals: buildReplySignals({
      questions,
      instructions,
      temporalAnchors,
      identityHints: nextIdentityHints,
      contextAtoms,
      atoms: safeAtoms,
      service
    }),
    contextAtoms
  }

  return {
    version: 2,
    strategy: 'regex_fast_signals_v1',
    event: buildEvent(event),
    atoms: safeAtoms,
    signals,
    service: buildService(service, signals)
  }
}

module.exports = {
  buildResponse
}
