'use strict'

const VALID_KINDS = new Set([
  'fact',
  'entity',
  'relationship',
  'open_loop',
  'episode',
  'preference',
  'boundary',
  'goal',
  'commitment',
  'instruction'
])

const SCHEMA_ID_RE = /^[a-z][a-z0-9_]{0,63}$/
const SEMANTIC_KEY_RE = /^[a-z][a-z0-9_-]{0,127}$/
const MODEL_NAME_RE = /^[a-z0-9][a-z0-9._:-]{1,80}$/i

const INTERNAL_STATE_IDS = new Set([
  'emotional_state',
  'emotional_response',
  'emotion_regulation',
  'coping_pattern',
  'internal_state',
  'mental_state',
  'distress_state',
  'stress_response',
  'stress_state',
  'anxiety_state',
  'fear_state',
  'grief_state',
  'coping_response'
])

const SELF_DIRECTED_IDS = new Set([
  'self_instruction',
  'self_directed_task',
  'task_focus',
  'attention_focus',
  'working_memory_task',
  'temporary_focus',
  'temporary_task',
  'self_regulation_task'
])

const MEDICAL_FRAGMENTS = [
  'medical',
  'health',
  'symptom',
  'treatment',
  'diagnos',
  'veterinar',
  'recovery',
  'illness'
]

const WORKFLOW_FRAGMENTS = [
  'workflow',
  'pipeline',
  'extractor',
  'debug',
  'prompt',
  'patch',
  'model',
  'snapshot',
  'mem0',
  'repo'
]

const WORKFLOW_TEXT_TERMS = [
  'extractor',
  'экстрактор',
  'mem0',
  'snapshot',
  'prompt',
  'промпт',
  'pipeline',
  'пайплайн',
  'patch',
  'патч',
  'logs',
  'log',
  'логи',
  'лог',
  'model',
  'модель',
  'debug',
  'дебаг'
]

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeInlineText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
}

function normalizeLowerText(value) {
  return normalizeInlineText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
}

function cloneRef(ref) {
  if (!ref || typeof ref !== 'object') {
    return {
      ref: null,
      role: 'unknown',
      label: null,
      confidence: 0
    }
  }

  return {
    ref: ref.ref != null ? String(ref.ref).trim() || null : null,
    role: ref.role != null ? String(ref.role).trim() || 'unknown' : 'unknown',
    label: ref.label != null ? normalizeInlineText(ref.label) || null : null,
    confidence:
      typeof ref.confidence === 'number'
        ? Math.max(0, Math.min(1, ref.confidence))
        : 0
  }
}

function blankRef() {
  return {
    ref: null,
    role: 'unknown',
    label: null,
    confidence: 0
  }
}

function cloneCandidate(candidate) {
  return {
    ...candidate,
    semantic: {
      ...(candidate?.semantic || {}),
      tags: safeArray(candidate?.semantic?.tags)
    },
    references: {
      subject: cloneRef(candidate?.references?.subject),
      object: cloneRef(candidate?.references?.object),
      about: safeArray(candidate?.references?.about).map((item) => cloneRef(item))
    },
    evidence: {
      ...(candidate?.evidence || {}),
      sourceSpans: safeArray(candidate?.evidence?.sourceSpans).map((item) => ({ ...item }))
    },
    temporal: {
      ...(candidate?.temporal || {})
    },
    memory: {
      ...(candidate?.memory || {})
    },
    source: {
      ...(candidate?.source || {})
    }
  }
}

function sanitizeSchemaId(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return SCHEMA_ID_RE.test(normalized) ? normalized : null
}

function sanitizeSemanticKey(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return SEMANTIC_KEY_RE.test(normalized) ? normalized : null
}

function sanitizeModelName(value, fallback = null) {
  const normalized = String(value || '').trim()
  const lowered = normalized.toLowerCase()

  if (!normalized) return fallback
  if (
    lowered === 'string' ||
    lowered === 'model' ||
    lowered === 'llm' ||
    lowered === 'openai' ||
    lowered === 'unknown' ||
    lowered === 'undefined' ||
    lowered === 'null' ||
    lowered === '[object object]'
  ) {
    return fallback
  }

  return MODEL_NAME_RE.test(normalized) ? normalized : fallback
}

function sanitizeSemantic(candidate) {
  const next = cloneCandidate(candidate)

  next.semantic.class = sanitizeSchemaId(next.semantic.class)
  next.semantic.subclass = sanitizeSchemaId(next.semantic.subclass)
  next.semantic.key = sanitizeSemanticKey(next.semantic.key)
  next.semantic.category = sanitizeSchemaId(next.semantic.category)
  next.semantic.tags = Array.from(new Set(
    safeArray(next.semantic.tags)
      .map((item) => sanitizeSchemaId(item))
      .filter(Boolean)
  )).slice(0, 5)

  return next.semantic.class ? next : null
}

function sanitizeSchema(candidate, packet) {
  const next = cloneCandidate(candidate)
  const fallbackModel = sanitizeModelName(packet?.meta?.usedModel, null)

  next.kind = VALID_KINDS.has(next.kind) ? next.kind : null
  next.source.model = sanitizeModelName(next?.source?.model, fallbackModel)
  next.source.promptVersion =
    next?.source?.promptVersion && String(next.source.promptVersion).trim()
      ? String(next.source.promptVersion).trim()
      : String(packet?.meta?.promptVersion || 'llm_memory_candidates_v1')
  next.source.extractor = 'llm'

  return next.kind ? next : null
}

function collectSemanticIds(candidate) {
  return [
    candidate?.semantic?.class,
    candidate?.semantic?.subclass,
    candidate?.semantic?.category,
    ...safeArray(candidate?.semantic?.tags)
  ]
    .map((item) => sanitizeSchemaId(item))
    .filter(Boolean)
}

function hasSemanticId(candidate, allowed) {
  return collectSemanticIds(candidate).some((item) => allowed.has(item))
}

function hasSemanticFragment(candidate, fragments) {
  return collectSemanticIds(candidate).some((item) =>
    fragments.some((fragment) => item.includes(fragment))
  )
}

function countWorkflowTextHits(text) {
  const source = normalizeLowerText(text)
  if (!source) return 0

  return WORKFLOW_TEXT_TERMS.reduce(
    (count, term) => count + (source.includes(term) ? 1 : 0),
    0
  )
}

function isTechnicalWorkflowCandidate(candidate) {
  if (hasSemanticFragment(candidate, WORKFLOW_FRAGMENTS)) {
    return true
  }

  const textHits = countWorkflowTextHits(candidate?.text)
  return textHits >= 2 || /(^|\s)(mem0|snapshot|pipeline)(\s|$)/i.test(String(candidate?.text || ''))
}

function isInternalStateCandidate(candidate) {
  return hasSemanticId(candidate, INTERNAL_STATE_IDS)
}

function isSelfDirectedTaskCandidate(candidate) {
  return (
    hasSemanticId(candidate, SELF_DIRECTED_IDS) ||
    hasSemanticId(candidate, INTERNAL_STATE_IDS)
  )
}

function remapKind(candidate) {
  const next = cloneCandidate(candidate)

  if (next.kind === 'relationship' && isInternalStateCandidate(next)) {
    next.kind = 'fact'
  } else if (next.kind === 'instruction' && isSelfDirectedTaskCandidate(next)) {
    next.kind = 'fact'
  } else if (
    (next.kind === 'goal' || next.kind === 'commitment') &&
    isInternalStateCandidate(next)
  ) {
    next.kind = 'fact'
  }

  return next
}

function sameRef(a, b) {
  return Boolean(a?.ref && b?.ref && a.ref === b.ref)
}

function dedupeRefs(refs) {
  const result = []
  const seen = new Set()

  for (const ref of safeArray(refs)) {
    const cloned = cloneRef(ref)
    const key = `${cloned.ref || ''}::${cloned.label || ''}::${cloned.role || ''}`

    if (seen.has(key)) continue
    seen.add(key)
    result.push(cloned)
  }

  return result
}

function isGarfieldRef(ref) {
  const refValue = normalizeLowerText(ref?.ref)
  const labelValue = normalizeLowerText(ref?.label)

  return (
    refValue.includes('garfield') ||
    refValue.includes('гарфилд') ||
    labelValue.includes('garfield') ||
    labelValue.includes('гарфилд')
  )
}

function hasGarfieldMedicalFallback(text) {
  const source = normalizeLowerText(text)

  return (
    (source.includes('гарфилд') || source.includes('garfield')) &&
    (
      source.includes('ветеринар') ||
      source.includes('ветклиник') ||
      source.includes('лечение') ||
      source.includes('диагноз')
    )
  )
}

function findGarfieldRef(references) {
  const pool = [
    references?.subject,
    references?.object,
    ...safeArray(references?.about)
  ]

  const hit = pool.find((ref) => isGarfieldRef(ref))
  return hit ? cloneRef(hit) : null
}

function isGarfieldMedicalCandidate(candidate) {
  return (
    hasSemanticFragment(candidate, MEDICAL_FRAGMENTS) &&
    Boolean(findGarfieldRef(candidate?.references))
  ) || hasGarfieldMedicalFallback(candidate?.text)
}

function repairReferences(candidate) {
  const next = cloneCandidate(candidate)

  if (next.kind !== 'relationship' && sameRef(next.references.subject, next.references.object)) {
    next.references.object = blankRef()
  }

  next.references.about = dedupeRefs(
    safeArray(next.references.about).filter((item) => !sameRef(item, next.references.subject))
  )

  if (!isGarfieldMedicalCandidate(next)) {
    return next
  }

  const garfieldRef = findGarfieldRef(next.references)
  if (!garfieldRef) {
    return next
  }

  if (
    next.references.subject?.role === 'core_character' ||
    next.references.subject?.ref === 'core_character:active' ||
    next.references.subject?.role === 'unknown'
  ) {
    next.references.subject = garfieldRef
  }

  if (
    next.kind !== 'relationship' &&
    (
      next.references.object?.role === 'core_character' ||
      next.references.object?.ref === 'core_character:active' ||
      sameRef(next.references.object, garfieldRef)
    )
  ) {
    next.references.object = blankRef()
  }

  next.references.about = dedupeRefs(
    safeArray(next.references.about).filter((item) => !sameRef(item, next.references.subject))
  )

  return next
}

function isWeakSelfReminder(candidate) {
  return (
    isSelfDirectedTaskCandidate(candidate) &&
    ['transient', 'unknown'].includes(candidate?.memory?.durability) &&
    Number(candidate?.memory?.stability || 0) < 0.6 &&
    Number(candidate?.memory?.memoryRelevance || 0) < 0.75
  )
}

function isTemporarySelfDirectedInstruction(candidate) {
  return (
    candidate?.kind === 'instruction' &&
    isSelfDirectedTaskCandidate(candidate) &&
    ['transient', 'unknown'].includes(candidate?.memory?.durability) &&
    Number(candidate?.memory?.stability || 0) < 0.75 &&
    Number(candidate?.memory?.memoryRelevance || 0) < 0.8
  )
}

function applyNoiseGate(candidate) {
  if (isTechnicalWorkflowCandidate(candidate)) {
    return true
  }

  if (isTemporarySelfDirectedInstruction(candidate)) {
    return true
  }

  if (
    (candidate.kind === 'fact' || candidate.kind === 'instruction') &&
    isWeakSelfReminder(candidate)
  ) {
    return true
  }

  return false
}

function refsSignature(ref) {
  const item = cloneRef(ref)
  return `${item.ref || ''}::${item.role || ''}::${item.label || ''}::${item.confidence || 0}`
}

function refsChanged(before, after) {
  const beforeAbout = safeArray(before?.about).map(refsSignature).join('|')
  const afterAbout = safeArray(after?.about).map(refsSignature).join('|')

  return (
    refsSignature(before?.subject) !== refsSignature(after?.subject) ||
    refsSignature(before?.object) !== refsSignature(after?.object) ||
    beforeAbout !== afterAbout
  )
}

function postprocessLlmCandidates(packet) {
  const source = packet && typeof packet === 'object' ? packet : {}
  const candidates = safeArray(source.candidates)

  const stats = {
    inputCandidates: candidates.length,
    outputCandidates: 0,
    droppedCandidates: 0,
    remappedCandidates: 0,
    repairedCandidates: 0
  }

  const nextCandidates = []

  for (const candidate of candidates) {
    const before = cloneCandidate(candidate)

    let next = sanitizeSchema(candidate, source)
    if (!next) {
      stats.droppedCandidates += 1
      continue
    }

    next = sanitizeSemantic(next)
    if (!next) {
      stats.droppedCandidates += 1
      continue
    }

    const repaired = repairReferences(next)
    if (refsChanged(before.references, repaired.references)) {
      stats.repairedCandidates += 1
    }

    const remapped = remapKind(repaired)
    if (remapped.kind !== before.kind) {
      stats.remappedCandidates += 1
    }

    if (applyNoiseGate(remapped)) {
      stats.droppedCandidates += 1
      continue
    }

    nextCandidates.push(remapped)
  }

  stats.outputCandidates = nextCandidates.length

  return {
    ...source,
    candidates: nextCandidates,
    debug: {
      ...(source.debug || {}),
      warnings: safeArray(source?.debug?.warnings),
      postprocess: stats
    }
  }
}

module.exports = {
  postprocessLlmCandidates,
  sanitizeSchema,
  sanitizeSemantic,
  repairReferences,
  remapKind,
  applyNoiseGate,
  sanitizeSemanticKey
}
