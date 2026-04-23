'use strict'

const { stableHash } = require('../utils/ids')
const { normalizeInlineText } = require('../utils/text')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function uniq(list = []) {
  return Array.from(new Set(list.filter(Boolean)))
}

function canonicalizeText(value) {
  return normalizeInlineText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)

    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value)
}

function textSimilarity(left, right) {
  const a = canonicalizeText(left)
  const b = canonicalizeText(right)

  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length)
  }

  return 0
}

function isTextVeryClose(left, right) {
  return textSimilarity(left, right) >= 0.85
}

function isTextClose(left, right) {
  return textSimilarity(left, right) >= 0.7
}

function isPayloadEmpty(value) {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return value === ''
}

function arePayloadsCompatible(left, right) {
  if (isPayloadEmpty(left) || isPayloadEmpty(right)) {
    return true
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return stableStringify(left) === stableStringify(right)
  }

  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object'
  ) {
    const sharedKeys = Object.keys(left).filter((key) =>
      Object.prototype.hasOwnProperty.call(right, key)
    )

    return sharedKeys.every((key) => arePayloadsCompatible(left[key], right[key]))
  }

  return stableStringify(left) === stableStringify(right)
}

function mergeCompatiblePayloads(left, right) {
  if (isPayloadEmpty(left)) return right || {}
  if (isPayloadEmpty(right)) return left || {}

  if (Array.isArray(left) || Array.isArray(right)) {
    return stableStringify(left) === stableStringify(right) ? left : null
  }

  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object'
  ) {
    const next = {
      ...left
    }

    for (const [key, value] of Object.entries(right)) {
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        next[key] = value
        continue
      }

      const mergedValue = mergeCompatiblePayloads(next[key], value)
      if (mergedValue === null) {
        return null
      }

      next[key] = mergedValue
    }

    return next
  }

  return stableStringify(left) === stableStringify(right) ? left : null
}

function buildPairKey(leftId, rightId) {
  return [leftId, rightId].sort().join('::')
}

function buildMergedCandidateId(kind, sourceCandidateIds = []) {
  return `llm_merged:${kind || 'candidate'}:${stableHash(sourceCandidateIds.slice().sort().join('::'))}`
}

function getImportanceRank(value) {
  switch (value) {
    case 'высокая':
      return 3
    case 'средняя':
      return 2
    case 'низкая':
      return 1
    default:
      return 0
  }
}

module.exports = {
  safeArray,
  uniq,
  canonicalizeText,
  stableStringify,
  textSimilarity,
  isTextVeryClose,
  isTextClose,
  isPayloadEmpty,
  arePayloadsCompatible,
  mergeCompatiblePayloads,
  buildPairKey,
  buildMergedCandidateId,
  getImportanceRank
}
