'use strict'

const { LLM_NORMALIZATION_CONFIG } = require('../config/normalization.config')

function normalizeTag(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, LLM_NORMALIZATION_CONFIG.tagSpacingStrategy === 'preserve_spaces' ? ' ' : '_')

  return normalized || null
}

function normalizeTags(candidate) {
  const sourceTags = Array.isArray(candidate?.rawTags)
    ? candidate.rawTags
    : Array.isArray(candidate?.tags)
      ? candidate.tags
      : []

  const seen = new Set()
  const normalizedTags = []
  const flags = []
  const warnings = []

  for (const tag of sourceTags) {
    const normalized = normalizeTag(tag)
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    normalizedTags.push(normalized)
  }

  if (sourceTags.length !== normalizedTags.length) {
    warnings.push('candidate_tags_deduplicated_or_cleaned')
  }

  if (!normalizedTags.length && sourceTags.length > 0) {
    flags.push('candidate_tags_empty_after_normalization')
  }

  return {
    sourceValue: sourceTags,
    normalizedValue: normalizedTags,
    flags,
    warnings,
    forceKeepRaw: sourceTags.length > 0 && JSON.stringify(sourceTags) !== JSON.stringify(normalizedTags)
  }
}

module.exports = {
  normalizeTags
}
