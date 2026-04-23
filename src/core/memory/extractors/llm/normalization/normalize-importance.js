'use strict'

const {
  IMPORTANCE_ALIAS_TO_NORMALIZED
} = require('../registries/importance.registry')

function canonicalizeImportance(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s-]+/g, '_')
}

function normalizeImportance(candidate) {
  const sourceValue =
    candidate?.rawImportance != null && String(candidate.rawImportance).trim()
      ? String(candidate.rawImportance)
      : candidate?.importance

  const canonical = canonicalizeImportance(sourceValue)
  const normalizedValue = IMPORTANCE_ALIAS_TO_NORMALIZED[canonical] || null
  const flags = []
  const warnings = []

  if (!canonical) {
    flags.push('missing_candidate_importance')
    warnings.push('candidate_importance_missing')
  } else if (!normalizedValue) {
    flags.push('unknown_candidate_importance')
    flags.push('importance_unstable_raw')
    warnings.push(`candidate_importance_unknown:${canonical}`)
  }

  return {
    sourceValue,
    normalizedValue,
    flags,
    warnings,
    forceKeepRaw: normalizedValue == null
  }
}

module.exports = {
  normalizeImportance
}
