'use strict'

const { LLM_NORMALIZATION_CONFIG } = require('../config/normalization.config')
const { normalizeInlineText, trimText } = require('../utils/text')

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sanitizePrimitive(value, flags) {
  if (typeof value === 'string') {
    const normalized = trimText(normalizeInlineText(value), LLM_NORMALIZATION_CONFIG.payload.maxStringLength)
    if (!normalized) return null
    if (normalized !== value) {
      flags.push('payload_string_cleaned')
    }
    return normalized
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value
  }

  return null
}

function sanitizePayloadValue(value, depth, flags) {
  if (depth > LLM_NORMALIZATION_CONFIG.payload.maxDepth) {
    flags.push('payload_depth_limited')
    return null
  }

  if (Array.isArray(value)) {
    const items = []

    for (const item of value.slice(0, LLM_NORMALIZATION_CONFIG.payload.maxArrayLength)) {
      const normalizedItem = sanitizePayloadValue(item, depth + 1, flags)
      if (normalizedItem !== null && normalizedItem !== undefined) {
        items.push(normalizedItem)
      }
    }

    if (value.length > LLM_NORMALIZATION_CONFIG.payload.maxArrayLength) {
      flags.push('payload_array_truncated')
    }

    return items
  }

  if (isPlainObject(value)) {
    const next = {}
    const entries = Object.entries(value).slice(0, LLM_NORMALIZATION_CONFIG.payload.maxObjectKeys)

    if (Object.keys(value).length > LLM_NORMALIZATION_CONFIG.payload.maxObjectKeys) {
      flags.push('payload_object_keys_truncated')
    }

    for (const [key, itemValue] of entries) {
      const normalizedKey = normalizeInlineText(key)
      if (!normalizedKey) continue
      const normalizedValue = sanitizePayloadValue(itemValue, depth + 1, flags)
      if (normalizedValue === null || normalizedValue === undefined) continue
      next[normalizedKey] = normalizedValue
    }

    return next
  }

  return sanitizePrimitive(value, flags)
}

function normalizePayload(candidate) {
  const sourceValue =
    candidate?.rawPayload !== undefined
      ? candidate.rawPayload
      : candidate?.payload

  const flags = []
  const warnings = []
  let normalizedValue = {}

  if (sourceValue == null) {
    normalizedValue = {}
  } else if (isPlainObject(sourceValue)) {
    normalizedValue = sanitizePayloadValue(sourceValue, 0, flags) || {}
  } else if (Array.isArray(sourceValue)) {
    normalizedValue = {
      items: sanitizePayloadValue(sourceValue, 0, flags) || []
    }
    flags.push('payload_wrapped_from_array')
    flags.push('payload_unstable')
    warnings.push('candidate_payload_wrapped_from_array')
  } else {
    normalizedValue = {
      value: sanitizePayloadValue(sourceValue, 0, flags)
    }
    flags.push('payload_wrapped_from_scalar')
    flags.push('payload_unstable')
    warnings.push('candidate_payload_wrapped_from_scalar')
  }

  return {
    sourceValue,
    normalizedValue: isPlainObject(normalizedValue) ? normalizedValue : {},
    flags,
    warnings,
    forceKeepRaw:
      sourceValue !== undefined &&
      JSON.stringify(sourceValue) !== JSON.stringify(normalizedValue)
  }
}

module.exports = {
  normalizePayload
}
