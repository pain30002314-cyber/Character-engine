'use strict'

const { stableHash } = require('../utils/ids')
const {
  normalizeInlineText,
  sanitizeTagList,
  toSafeKey,
  trimText
} = require('../utils/text')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function uniq(list = []) {
  return Array.from(new Set(safeArray(list).filter(Boolean)))
}

function uniqObjectsBy(items = [], getKey) {
  const seen = new Set()
  const result = []

  for (const item of safeArray(items)) {
    const key = getKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

function hasRoutingTarget(candidate, target) {
  return safeArray(candidate?.routingTargets).includes(target)
}

function getCandidatesByTarget(candidatePool, target) {
  return safeArray(candidatePool?.candidates).filter((candidate) =>
    hasRoutingTarget(candidate, target)
  )
}

function pickFirstText(...values) {
  for (const value of values) {
    const normalized = normalizeInlineText(value)
    if (normalized) return normalized
  }

  return null
}

function pickStringList(...valueGroups) {
  const values = []

  for (const group of valueGroups) {
    if (Array.isArray(group)) {
      values.push(...group)
      continue
    }

    if (group != null) {
      values.push(group)
    }
  }

  return uniq(
    values
      .map((item) => normalizeInlineText(item))
      .filter(Boolean)
  )
}

function coerceImportanceSeed(value) {
  switch (String(value || '').trim()) {
    case 'высокая':
      return 'high'
    case 'средняя':
      return 'medium'
    case 'низкая':
      return 'low'
    default:
      return 'unknown'
  }
}

function buildResolutionId(prefix, candidate, suffix = 'primary') {
  return `${prefix}:${stableHash(
    `${candidate?.candidateId || candidate?.id || 'candidate'}::${suffix}`
  )}`
}

function buildPacketProvenance(candidate, candidatePool = {}) {
  return {
    traceId: candidate?.traceId || candidatePool?.traceId || null,
    eventId: candidate?.eventId || candidatePool?.eventId || null,
    threadId: candidate?.threadId || candidatePool?.threadId || null,
    candidateId: candidate?.candidateId || candidate?.id || null,
    sourcePass: candidate?.sourcePass || null,
    sourceCandidateIds: safeArray(candidate?.sourceCandidateIds),
    mergedFrom: safeArray(candidate?.mergedFrom),
    routingTargets: safeArray(candidate?.routingTargets),
    lifecycleStatus: candidate?.lifecycleStatus || null,
    lifecycleUpdatedAt: candidate?.lifecycleUpdatedAt || null,
    timestampIso: candidate?.timestamp_iso || null
  }
}

function extractPayloadList(payload, keys = []) {
  const items = []

  for (const key of keys) {
    const value = payload?.[key]

    if (Array.isArray(value)) {
      items.push(...value)
      continue
    }

    if (value != null) {
      items.push(value)
    }
  }

  return pickStringList(items)
}

function buildSummarySeeds(candidate) {
  const summaryShort = pickFirstText(candidate?.summary, trimText(candidate?.text, 180))
  const summaryLong = pickFirstText(candidate?.text, candidate?.summary)

  return {
    summaryShort,
    summaryLong
  }
}

function buildConfidenceSeed(candidate) {
  if (typeof candidate?.confidenceScore === 'number') {
    return Math.max(0, Math.min(1, candidate.confidenceScore))
  }

  if (typeof candidate?.confidence === 'number') {
    return Math.max(0, Math.min(1, candidate.confidence))
  }

  return null
}

function buildCandidateBucketRef(candidate, bucket) {
  return `${bucket}:${toSafeKey(candidate?.kind || candidate?.sourcePass || 'candidate')}`
}

module.exports = {
  safeArray,
  uniq,
  uniqObjectsBy,
  hasRoutingTarget,
  getCandidatesByTarget,
  pickFirstText,
  pickStringList,
  coerceImportanceSeed,
  buildResolutionId,
  buildPacketProvenance,
  extractPayloadList,
  buildSummarySeeds,
  buildConfidenceSeed,
  buildCandidateBucketRef,
  sanitizeTagList
}
