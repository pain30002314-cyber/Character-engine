'use strict'

const { isPlainObject, safeArray } = require('../utils/safe-json')
const { normalizeImportanceLabel } = require('../utils/language')
const {
  normalizeInlineText,
  sanitizeTagList
} = require('../utils/text')

function validateCandidateShape(candidate, index) {
  if (!isPlainObject(candidate)) {
    return {
      ok: false,
      dropped: {
        index,
        reason: 'candidate_not_object',
        raw: candidate
      }
    }
  }

  const kind = normalizeInlineText(candidate.kind)
  const text = normalizeInlineText(candidate.text)
  const summary = normalizeInlineText(candidate.summary) || text
  const importance = normalizeImportanceLabel(candidate.importance)
  const tags = sanitizeTagList(candidate.tags)
  const payload = isPlainObject(candidate.payload) ? candidate.payload : {}
  const warnings = []

  if (!kind) {
    return {
      ok: false,
      dropped: {
        index,
        reason: 'candidate_kind_missing',
        raw: candidate
      }
    }
  }

  if (!text) {
    return {
      ok: false,
      dropped: {
        index,
        reason: 'candidate_text_missing',
        raw: candidate
      }
    }
  }

  if (!normalizeInlineText(candidate.summary)) {
    warnings.push('candidate_summary_fallback_to_text')
  }

  if (!importance) {
    warnings.push('candidate_importance_defaulted')
  }

  if (!Array.isArray(candidate.tags)) {
    warnings.push('candidate_tags_defaulted')
  }

  if (!isPlainObject(candidate.payload)) {
    warnings.push('candidate_payload_defaulted')
  }

  return {
    ok: true,
    value: {
      index,
      kind,
      text,
      summary,
      importance: importance || 'средняя',
      tags,
      payload,
      raw: candidate,
      warnings
    }
  }
}

function validateLlmOutput(parsedValue) {
  if (!isPlainObject(parsedValue)) {
    return {
      ok: false,
      status: 'failed',
      validCandidates: [],
      droppedCandidates: [],
      warnings: [],
      errors: ['parsed_output_is_not_object']
    }
  }

  if (!Object.prototype.hasOwnProperty.call(parsedValue, 'candidates')) {
    return {
      ok: false,
      status: 'failed',
      validCandidates: [],
      droppedCandidates: [],
      warnings: [],
      errors: ['candidates_field_missing']
    }
  }

  if (!Array.isArray(parsedValue.candidates)) {
    return {
      ok: false,
      status: 'failed',
      validCandidates: [],
      droppedCandidates: [],
      warnings: [],
      errors: ['candidates_field_is_not_array']
    }
  }

  const validCandidates = []
  const droppedCandidates = []
  const warnings = []

  for (const [index, candidate] of safeArray(parsedValue.candidates).entries()) {
    const validation = validateCandidateShape(candidate, index)

    if (!validation.ok) {
      droppedCandidates.push(validation.dropped)
      warnings.push(`candidate_dropped:${validation.dropped.reason}:${index}`)
      continue
    }

    validCandidates.push(validation.value)
    warnings.push(...validation.value.warnings.map((item) => `${item}:${index}`))
  }

  const status =
    droppedCandidates.length > 0
      ? validCandidates.length > 0
        ? 'partial'
        : 'failed'
      : 'success'

  const errors = validCandidates.length > 0 ? [] : droppedCandidates.length > 0 ? ['no_valid_candidates'] : []

  return {
    ok: validCandidates.length > 0 || safeArray(parsedValue.candidates).length === 0,
    status:
      safeArray(parsedValue.candidates).length === 0
        ? 'success'
        : status,
    validCandidates,
    droppedCandidates,
    warnings,
    errors,
    stats: {
      parsedCandidateCount: safeArray(parsedValue.candidates).length,
      validCandidateCount: validCandidates.length,
      droppedCandidateCount: droppedCandidates.length
    }
  }
}

module.exports = {
  validateLlmOutput
}
