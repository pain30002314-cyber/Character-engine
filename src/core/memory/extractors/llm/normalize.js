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

const VALID_REF_ROLES = new Set([
  'core_user',
  'core_character',
  'third_party',
  'entity',
  'unknown'
])

const VALID_EVIDENCE_KINDS = new Set([
  'literal',
  'inferred',
  'contextual'
])

const VALID_TENSES = new Set([
  'past',
  'present',
  'ongoing',
  'future',
  'unknown'
])

const VALID_DURABILITY = new Set([
  'stable',
  'episodic',
  'transient',
  'unknown'
])

const VALID_SENSITIVITY = new Set([
  'low',
  'medium',
  'high'
])

const VALID_CONFIRMATION_STATUS = new Set([
  'single_shot',
  'repeated',
  'uncertain'
])

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeInlineText(value) {
  return normalizeText(value).replace(/\n+/g, ' ')
}

function normalizeLowerText(value) {
  return normalizeInlineText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
}

function clamp01(value, fallback = 0) {
  const num = Number(value)
  if (Number.isNaN(num)) return fallback
  return Math.max(0, Math.min(1, num))
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function pickEnum(value, allowedSet, fallback) {
  const normalized = String(value || '').trim()
  return allowedSet.has(normalized) ? normalized : fallback
}

function sanitizeRef(ref) {
  const source = ref && typeof ref === 'object' ? ref : {}

  const result = {
    ref: source.ref != null ? String(source.ref).trim() || null : null,
    role: pickEnum(source.role, VALID_REF_ROLES, 'unknown'),
    label: source.label != null ? normalizeInlineText(source.label) || null : null,
    confidence: clamp01(source.confidence, 0)
  }

  if (!result.ref && !result.label) {
    return null
  }

  return result
}

function sanitizeSourceSpan(span) {
  const source = span && typeof span === 'object' ? span : {}
  const text = normalizeInlineText(source.text)

  if (!text) {
    return null
  }

  const start = Number.isInteger(source.start) ? source.start : 0
  const end = Number.isInteger(source.end) ? source.end : 0

  return {
    text,
    start: Math.max(0, start),
    end: Math.max(0, end)
  }
}

function hasRequiredSemanticCore(semantic) {
  return Boolean(semantic && semantic.class)
}

function hasMeaningfulText(candidate) {
  return Boolean(candidate.text && candidate.normalizedText)
}

function hasMinimalReferences(references) {
  return Boolean(
    references &&
    references.subject &&
    typeof references.subject === 'object' &&
    references.object &&
    typeof references.object === 'object'
  )
}

function hasMinimalEvidence(evidence) {
  return Boolean(evidence && evidence.kind)
}

function hasMinimalTemporal(temporal) {
  return Boolean(temporal && temporal.tense)
}

function hasMinimalMemory(memory) {
  return Boolean(
    memory &&
    memory.durability &&
    typeof memory.salience === 'number' &&
    typeof memory.stability === 'number' &&
    typeof memory.memoryRelevance === 'number'
  )
}

function hasMinimalSource(source) {
  return Boolean(
    source &&
    source.extractor &&
    source.promptVersion &&
    Object.prototype.hasOwnProperty.call(source, 'sourceEventId')
  )
}

function sanitizeModelName(value, fallback = '') {
  const normalized = String(value || '').trim()
  const lowered = normalized.toLowerCase()

  if (!normalized) return fallback
  if (lowered === 'string') return fallback
  if (lowered === 'null') return fallback
  if (lowered === 'unknown') return fallback
  if (lowered === 'undefined') return fallback

  return normalized
}

function sanitizeCandidate(candidate, index, packet, fallback = {}) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const fallbackEvent =
    fallback?.event && typeof fallback.event === 'object' ? fallback.event : {}
  const fallbackMeta =
    fallback?.meta && typeof fallback.meta === 'object' ? fallback.meta : {}

  const kind = pickEnum(source.kind, VALID_KINDS, null)
  const text = normalizeInlineText(source.text)
  const normalizedText =
    normalizeLowerText(source.normalizedText) || normalizeLowerText(text)

  const semanticInput =
    source.semantic && typeof source.semantic === 'object'
      ? source.semantic
      : {}

  const referencesInput =
    source.references && typeof source.references === 'object'
      ? source.references
      : {}

  const evidenceInput =
    source.evidence && typeof source.evidence === 'object'
      ? source.evidence
      : {}

  const temporalInput =
    source.temporal && typeof source.temporal === 'object'
      ? source.temporal
      : {}

  const memoryInput =
    source.memory && typeof source.memory === 'object'
      ? source.memory
      : {}

  const sourceInput =
    source.source && typeof source.source === 'object'
      ? source.source
      : {}

  const subject = sanitizeRef(referencesInput.subject) || {
    ref: null,
    role: 'unknown',
    label: null,
    confidence: 0
  }

  const object = sanitizeRef(referencesInput.object) || {
    ref: null,
    role: 'unknown',
    label: null,
    confidence: 0
  }

  const about = safeArray(referencesInput.about)
    .map((item) => sanitizeRef(item))
    .filter(Boolean)

  const sourceSpans = safeArray(evidenceInput.sourceSpans)
    .map((item) => sanitizeSourceSpan(item))
    .filter(Boolean)

  const sanitized = {
    id:
      source.id != null && String(source.id).trim()
        ? String(source.id).trim()
        : `llm_candidate_${packet?.event?.id || fallbackEvent.id || 'evt'}_${index + 1}`,

    kind,

    text,
    normalizedText,
    summary:
      source.summary != null
        ? normalizeInlineText(source.summary) || null
        : null,
    confidence: clamp01(source.confidence, 0.55),

    semantic: {
      class:
        semanticInput.class != null
          ? String(semanticInput.class).trim() || null
          : null,
      subclass:
        semanticInput.subclass != null
          ? String(semanticInput.subclass).trim() || null
          : null,
      key:
        semanticInput.key != null
          ? String(semanticInput.key).trim() || null
          : null,
      category:
        semanticInput.category != null
          ? String(semanticInput.category).trim() || null
          : null,
      tags: safeArray(semanticInput.tags)
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    },

    references: {
      subject,
      object,
      about
    },

    evidence: {
      kind: pickEnum(evidenceInput.kind, VALID_EVIDENCE_KINDS, 'literal'),
      sourceSpans,
      quoted: Boolean(evidenceInput.quoted),
      reported: Boolean(evidenceInput.reported),
      negated: Boolean(evidenceInput.negated),
      hypothetical: Boolean(evidenceInput.hypothetical),
      conditional: Boolean(evidenceInput.conditional),
      interrogative: Boolean(evidenceInput.interrogative),
      imperative: Boolean(evidenceInput.imperative),
      hedged: Boolean(evidenceInput.hedged)
    },

    temporal: {
      tense: pickEnum(temporalInput.tense, VALID_TENSES, 'unknown'),
      anchorText:
        temporalInput.anchorText != null
          ? normalizeInlineText(temporalInput.anchorText) || null
          : null,
      resolvedAt:
        temporalInput.resolvedAt != null
          ? String(temporalInput.resolvedAt).trim() || null
          : null,
      isRecurring: Boolean(temporalInput.isRecurring),
      recurrenceHint:
        temporalInput.recurrenceHint != null
          ? normalizeInlineText(temporalInput.recurrenceHint) || null
          : null
    },

    memory: {
      durability: pickEnum(memoryInput.durability, VALID_DURABILITY, 'unknown'),
      salience: clamp01(memoryInput.salience, 0.5),
      stability: clamp01(memoryInput.stability, 0.5),
      memoryRelevance: clamp01(memoryInput.memoryRelevance, 0.5),
      sensitivity: pickEnum(memoryInput.sensitivity, VALID_SENSITIVITY, 'low'),
      confirmationStatus: pickEnum(
        memoryInput.confirmationStatus,
        VALID_CONFIRMATION_STATUS,
        'uncertain'
      )
    },

    source: {
      extractor: 'llm',
      model: sanitizeModelName(
        sourceInput.model,
        sanitizeModelName(fallbackMeta.usedModel, '')
      ),
      promptVersion:
        sourceInput.promptVersion != null && String(sourceInput.promptVersion).trim()
          ? String(sourceInput.promptVersion).trim()
          : String(fallbackMeta.promptVersion || 'llm_memory_candidates_v1'),
      sourceEventId:
        sourceInput.sourceEventId != null && String(sourceInput.sourceEventId).trim()
          ? String(sourceInput.sourceEventId).trim()
          : packet?.event?.id || fallbackEvent.id || null,
      timestamp:
        sourceInput.timestamp != null && String(sourceInput.timestamp).trim()
          ? String(sourceInput.timestamp).trim()
          : packet?.event?.timestamp || fallbackEvent.timestamp || null
    }
  }

  if (!kind) return null
  if (!hasMeaningfulText(sanitized)) return null
  if (!hasRequiredSemanticCore(sanitized.semantic)) return null
  if (!hasMinimalReferences(sanitized.references)) return null
  if (!hasMinimalEvidence(sanitized.evidence)) return null
  if (!hasMinimalTemporal(sanitized.temporal)) return null
  if (!hasMinimalMemory(sanitized.memory)) return null
  if (!hasMinimalSource(sanitized.source)) return null

  return sanitized
}

function buildCandidateDedupeKey(candidate) {
  return [
    candidate.kind,
    candidate.semantic?.class || '',
    candidate.semantic?.key || '',
    normalizeLowerText(candidate.normalizedText || candidate.text || ''),
    candidate.references?.subject?.ref || candidate.references?.subject?.label || '',
    candidate.references?.object?.ref || candidate.references?.object?.label || ''
  ].join('::')
}

function dedupeCandidates(candidates) {
  const map = new Map()

  for (const candidate of safeArray(candidates)) {
    const key = buildCandidateDedupeKey(candidate)
    const existing = map.get(key)

    if (!existing) {
      map.set(key, candidate)
      continue
    }

    const existingScore =
      (existing.confidence || 0) +
      (existing.memory?.memoryRelevance || 0) +
      (existing.memory?.salience || 0)

    const currentScore =
      (candidate.confidence || 0) +
      (candidate.memory?.memoryRelevance || 0) +
      (candidate.memory?.salience || 0)

    if (currentScore > existingScore) {
      map.set(key, candidate)
    }
  }

  return Array.from(map.values())
}

function sanitizeTemporal(temporal, fallbackMessageTime = null) {
  const source = temporal && typeof temporal === 'object' ? temporal : {}

  return {
    messageTime:
      source.messageTime != null
        ? String(source.messageTime).trim() || fallbackMessageTime
        : fallbackMessageTime,
    anchors: safeArray(source.anchors)
      .map((item) => {
        const text = normalizeInlineText(item?.text)
        if (!text) return null

        return {
          text,
          resolvedAt:
            item?.resolvedAt != null
              ? String(item.resolvedAt).trim() || null
              : null,
          tense: pickEnum(item?.tense, VALID_TENSES, 'unknown')
        }
      })
      .filter(Boolean)
  }
}

function normalizeMemoryCandidatesPacket(packet, fallback = {}) {
  const source = packet && typeof packet === 'object' ? packet : {}
  const fallbackEvent =
    fallback.event && typeof fallback.event === 'object' ? fallback.event : {}
  const fallbackMeta =
    fallback.meta && typeof fallback.meta === 'object' ? fallback.meta : {}

  const normalized = {
    version: 1,
    strategy: 'llm_memory_candidates_v1',

    event: {
      id:
        source?.event?.id != null
          ? String(source.event.id).trim() || fallbackEvent.id || null
          : fallbackEvent.id || null,
      threadId:
        source?.event?.threadId != null
          ? String(source.event.threadId).trim() || null
          : fallbackEvent.threadId || null,
      role:
        source?.event?.role != null
          ? String(source.event.role).trim() || 'user'
          : fallbackEvent.role || 'user',
      platform:
        source?.event?.platform != null
          ? String(source.event.platform).trim() || null
          : fallbackEvent.platform || null,
      channel:
        source?.event?.channel != null
          ? String(source.event.channel).trim() || null
          : fallbackEvent.channel || null,
      world:
        source?.event?.world != null
          ? String(source.event.world).trim() || null
          : fallbackEvent.world || null,
      timestamp:
        source?.event?.timestamp != null
          ? String(source.event.timestamp).trim() || null
          : fallbackEvent.timestamp || null,
      text:
        source?.event?.text != null
          ? String(source.event.text)
          : fallbackEvent.text || '',
      meta:
        source?.event?.meta && typeof source.event.meta === 'object'
          ? source.event.meta
          : fallbackEvent.meta || {}
    },

    context: {
      eventWindow: safeArray(source?.context?.eventWindow).map((item, index) => ({
        index,
        id: item?.id != null ? String(item.id).trim() || null : null,
        role: item?.role != null ? String(item.role).trim() || 'user' : 'user',
        timestamp:
          item?.timestamp != null ? String(item.timestamp).trim() || null : null,
        text: item?.text != null ? String(item.text) : ''
      })),
    identity: {
      coreUserRef:
        source?.context?.identity?.coreUserRef != null
          ? String(source.context.identity.coreUserRef).trim() || 'core_user:main'
          : 'core_user:main',

      coreCharacterRef:
        source?.context?.identity?.coreCharacterRef != null
          ? String(source.context.identity.coreCharacterRef).trim() || 'core_character:active'
          : 'core_character:active',

      userDisplayName:
        source?.context?.identity?.userDisplayName != null
          ? String(source.context.identity.userDisplayName).trim() || null
          : null,

      characterDisplayName:
        source?.context?.identity?.characterDisplayName != null
          ? String(source.context.identity.characterDisplayName).trim() || null
          : null
    }
    },

    candidates: [],

    temporal: {
      messageTime: null,
      anchors: []
    },

    meta: {
      source: 'llm',
      usedModel: sanitizeModelName(
        source?.meta?.usedModel,
        sanitizeModelName(fallbackMeta.usedModel, null)
      ),
      promptVersion:
        source?.meta?.promptVersion != null && String(source.meta.promptVersion).trim()
          ? String(source.meta.promptVersion).trim()
          : String(fallbackMeta.promptVersion || 'llm_memory_candidates_v1'),
      extractorVersion:
        source?.meta?.extractorVersion != null && String(source.meta.extractorVersion).trim()
          ? String(source.meta.extractorVersion).trim()
          : fallbackMeta.extractorVersion || null,
      durationMs: Number.isFinite(source?.meta?.durationMs)
        ? Math.max(0, Number(source.meta.durationMs))
        : 0
    },

    debug: {
      rawModelContent:
        source?.debug?.rawModelContent != null
          ? String(source.debug.rawModelContent)
          : null,
      parsed:
        source?.debug?.parsed && typeof source.debug.parsed === 'object'
          ? source.debug.parsed
          : source?.debug?.parsed || null,
      warnings: safeArray(source?.debug?.warnings).map((item) => String(item))
    }
  }

  normalized.temporal = sanitizeTemporal(
    source?.temporal,
    normalized.event.timestamp || null
  )

  normalized.candidates = dedupeCandidates(
    safeArray(source?.candidates)
      .map((candidate, index) =>
        sanitizeCandidate(candidate, index, normalized, {
          event: normalized.event,
          meta: normalized.meta
        })
      )
      .filter(Boolean)
  )

  return normalized
}

module.exports = {
  normalizeMemoryCandidatesPacket,
  dedupeCandidates
}