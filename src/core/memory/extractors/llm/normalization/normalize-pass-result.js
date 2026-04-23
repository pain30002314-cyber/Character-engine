'use strict'

const { normalizeInlineText } = require('../utils/text')
const { normalizeKind } = require('./normalize-kind')
const { normalizeImportance } = require('./normalize-importance')
const { normalizeTags } = require('./normalize-tags')
const { normalizePayload } = require('./normalize-payload')
const { preserveRawValues } = require('./preserve-raw-values')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function uniq(list = []) {
  return Array.from(new Set(list.filter(Boolean)))
}

function normalizeTextFields(candidate, flags, warnings, changedFields) {
  const next = {
    ...candidate
  }

  const normalizedText = normalizeInlineText(candidate?.text)
  const normalizedSummary = normalizeInlineText(candidate?.summary)

  if (normalizedText !== candidate?.text) {
    next.text = normalizedText
    changedFields.push('text')
    warnings.push('candidate_text_cleaned')
  }

  if (normalizedSummary !== candidate?.summary) {
    next.summary = normalizedSummary
    changedFields.push('summary')
    warnings.push('candidate_summary_cleaned')
  }

  if (!next.text) {
    flags.push('candidate_text_empty_after_normalization')
  }

  if (!next.summary && next.text) {
    next.summary = next.text
    changedFields.push('summary')
    warnings.push('candidate_summary_fallback_to_text_after_normalization')
  }

  return next
}

function normalizeCandidate(candidate, passKey) {
  const flags = uniq(candidate?.flags || [])
  const warnings = []
  const changedFields = []

  let next = normalizeTextFields(candidate, flags, warnings, changedFields)

  const kindResult = normalizeKind(next, passKey)
  const importanceResult = normalizeImportance(next)
  const tagsResult = normalizeTags(next)
  const payloadResult = normalizePayload(next)

  const preserved = preserveRawValues(next, [
    {
      field: 'kind',
      rawField: 'rawKind',
      sourceValue: kindResult.sourceValue,
      normalizedValue: kindResult.normalizedValue,
      forceKeepRaw: kindResult.forceKeepRaw
    },
    {
      field: 'importance',
      rawField: 'rawImportance',
      sourceValue: importanceResult.sourceValue,
      normalizedValue: importanceResult.normalizedValue,
      forceKeepRaw: importanceResult.forceKeepRaw
    },
    {
      field: 'tags',
      rawField: 'rawTags',
      sourceValue: tagsResult.sourceValue,
      normalizedValue: tagsResult.normalizedValue,
      forceKeepRaw: tagsResult.forceKeepRaw
    },
    {
      field: 'payload',
      rawField: 'rawPayload',
      sourceValue: payloadResult.sourceValue,
      normalizedValue: payloadResult.normalizedValue,
      forceKeepRaw: payloadResult.forceKeepRaw
    }
  ])

  next = preserved.candidate
  next.normalizedTags = next.tags
  next.semantic = {
    ...(next.semantic || {}),
    tags: next.tags
  }
  next.flags = uniq([
    ...flags,
    ...kindResult.flags,
    ...importanceResult.flags,
    ...tagsResult.flags,
    ...payloadResult.flags
  ])

  warnings.push(
    ...kindResult.warnings,
    ...importanceResult.warnings,
    ...tagsResult.warnings,
    ...payloadResult.warnings
  )

  changedFields.push(...preserved.changedFields)

  next.normalization = {
    changedFields: uniq(changedFields),
    preservedRawFields: preserved.preservedRawFields,
    warnings: uniq(warnings)
  }

  return {
    candidate: next,
    warnings: uniq(warnings),
    changedFields: uniq(changedFields),
    preservedRawFields: preserved.preservedRawFields
  }
}

function normalizePassResult(passResult) {
  const sourcePass = passResult?.sourcePass || passResult?.extractorKey || null
  const candidates = safeArray(passResult?.candidates)
  const normalizedCandidates = []
  const existingWarnings = safeArray(passResult?.warnings)
  const normalizationWarnings = []
  const changedFieldsSummary = {}
  let normalizedCandidateCount = 0

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate, sourcePass)
    normalizedCandidates.push(normalized.candidate)
    normalizedCandidateCount += 1

    for (const field of normalized.changedFields) {
      changedFieldsSummary[field] = (changedFieldsSummary[field] || 0) + 1
    }

    normalizationWarnings.push(...normalized.warnings)
  }

  return {
    ...passResult,
    candidates: normalizedCandidates,
    warnings: uniq([...existingWarnings, ...normalizationWarnings]),
    normalizationMeta: {
      status: 'completed',
      sourcePass,
      candidateCountBefore: candidates.length,
      candidateCountAfter: normalizedCandidates.length,
      normalizedCandidateCount,
      changedFieldsSummary,
      warnings: uniq(normalizationWarnings)
    }
  }
}

module.exports = {
  normalizePassResult
}
