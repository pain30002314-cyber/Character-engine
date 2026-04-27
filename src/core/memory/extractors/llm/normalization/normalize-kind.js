'use strict'

const { LLM_NORMALIZATION_CONFIG } = require('../config/normalization.config')
const {
  KIND_ALIAS_TO_NORMALIZED_BY_PASS,
  canonicalizeKindAlias,
  getFallbackKindForPass
} = require('../registries/kind.registry')

function normalizeKind(candidate, passKey) {
  const sourceValue =
    candidate?.rawKind != null && String(candidate.rawKind).trim()
      ? String(candidate.rawKind)
      : candidate?.kind

  const canonical = canonicalizeKindAlias(sourceValue)
  const normalizedPassKey = String(passKey || '').trim()
  const aliasMap = KIND_ALIAS_TO_NORMALIZED_BY_PASS[normalizedPassKey] || null
  const fallbackKind = getFallbackKindForPass(normalizedPassKey)
  const hasKnownSourcePass = Boolean(aliasMap)
  const hasAllowedKind =
    canonical && hasKnownSourcePass && Object.prototype.hasOwnProperty.call(aliasMap, canonical)
  const flags = []
  const warnings = []
  let normalizedKind = LLM_NORMALIZATION_CONFIG.unknownKindFallback
  let forceKeepRaw = false

  if (!canonical) {
    if (!hasKnownSourcePass) {
      flags.push('missing_candidate_kind')
      flags.push('unknown_source_pass_for_kind_fallback')
      warnings.push('candidate_kind_missing')
      normalizedKind = LLM_NORMALIZATION_CONFIG.unknownKindFallback
      forceKeepRaw = true
    } else {
      flags.push('missing_candidate_kind')
      flags.push('kind_fallback_from_source_pass')
      flags.push('kind_not_allowed_for_pass')
      warnings.push('candidate_kind_missing')
      warnings.push(`kind_fallback_from_source_pass:missing:${fallbackKind}`)
      normalizedKind = fallbackKind
      forceKeepRaw = true
    }
  } else if (!hasKnownSourcePass) {
    flags.push('unknown_source_pass_for_kind_fallback')
    warnings.push(`candidate_kind_unknown:${canonical}`)
    normalizedKind = LLM_NORMALIZATION_CONFIG.unknownKindFallback
    forceKeepRaw = true
  } else if (!hasAllowedKind) {
    flags.push('kind_fallback_from_source_pass')
    flags.push('kind_not_allowed_for_pass')
    warnings.push(`kind_fallback_from_source_pass:${sourceValue}:${fallbackKind}`)
    normalizedKind = fallbackKind
    forceKeepRaw = true
  } else {
    normalizedKind = aliasMap[canonical]
  }

  return {
    sourceValue,
    normalizedValue: normalizedKind,
    flags,
    warnings,
    forceKeepRaw
  }
}

module.exports = {
  normalizeKind
}
