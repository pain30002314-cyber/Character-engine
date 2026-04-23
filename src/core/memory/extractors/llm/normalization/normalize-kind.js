'use strict'

const { LLM_NORMALIZATION_CONFIG } = require('../config/normalization.config')
const {
  KIND_ALIAS_TO_NORMALIZED_BY_PASS,
  canonicalizeKindAlias
} = require('../registries/kind.registry')

function normalizeKind(candidate, passKey) {
  const sourceValue =
    candidate?.rawKind != null && String(candidate.rawKind).trim()
      ? String(candidate.rawKind)
      : candidate?.kind

  const canonical = canonicalizeKindAlias(sourceValue)
  const aliasMap = KIND_ALIAS_TO_NORMALIZED_BY_PASS[passKey] || {}
  const normalizedKind = aliasMap[canonical] || LLM_NORMALIZATION_CONFIG.unknownKindFallback
  const flags = []
  const warnings = []

  if (!canonical) {
    flags.push('missing_candidate_kind')
    warnings.push('candidate_kind_missing')
  } else if (!aliasMap[canonical]) {
    flags.push('unknown_candidate_kind')
    flags.push('unknown_kind_raw')
    warnings.push(`candidate_kind_unknown:${canonical}`)
  }

  return {
    sourceValue,
    normalizedValue: normalizedKind,
    flags,
    warnings,
    forceKeepRaw: normalizedKind === LLM_NORMALIZATION_CONFIG.unknownKindFallback
  }
}

module.exports = {
  normalizeKind
}
