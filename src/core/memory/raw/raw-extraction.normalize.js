const { RAW_CLAIM_TYPE } = require('../../../shared/memory.types')
const { createRawClaim } = require('./raw-extraction.builder')

function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeClaimType(value) {
  const raw = String(value || '').trim().toLowerCase()

  switch (raw) {
    case 'fact':
      return RAW_CLAIM_TYPE.FACT
    case 'entity':
      return RAW_CLAIM_TYPE.ENTITY
    case 'relationship':
      return RAW_CLAIM_TYPE.RELATIONSHIP
    case 'open_loop':
    case 'openloop':
      return RAW_CLAIM_TYPE.OPEN_LOOP
    case 'episode':
      return RAW_CLAIM_TYPE.EPISODE
    default:
      return null
  }
}

function clampConfidence(value, fallback = 0.5) {
  const num = Number(value)
  if (Number.isNaN(num)) return fallback
  return Math.max(0, Math.min(1, num))
}

function normalizeLlmObservation(observation, event) {
  const claimType = normalizeClaimType(observation?.claimType || observation?.kind)
  const text = safeText(observation?.text)

  if (!claimType || !text) {
    return null
  }

  const payload =
    observation?.payload && typeof observation.payload === 'object'
      ? observation.payload
      : {}

  return createRawClaim({
    claimType,
    text,
    payload: {
      ...payload,
      source: 'llm'
    },
    confidence: clampConfidence(observation?.confidence, 0.55),
    sourceEventId: event.id,
    timestamp: event.timestamp
  })
}

function dedupeClaims(claims) {
  const map = new Map()

  for (const claim of claims || []) {
    const key = `${claim.claimType}::${String(claim.text || '').toLowerCase()}`
    const prev = map.get(key)

    if (!prev) {
      map.set(key, claim)
      continue
    }

    map.set(key, {
      ...prev,
      ...claim,
      confidence: Math.max(prev.confidence || 0, claim.confidence || 0),
      payload: {
        ...(prev.payload || {}),
        ...(claim.payload || {})
      }
    })
  }

  return [...map.values()]
}

module.exports = {
  normalizeLlmObservation,
  dedupeClaims
}