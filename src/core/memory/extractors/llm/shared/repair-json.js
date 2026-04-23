'use strict'

const {
  isPlainObject,
  safeJsonParse,
  stripMarkdownCodeFences,
  findBalancedJsonFragment,
  appendMissingClosers,
  stripTrailingCommas,
  normalizeJsonText
} = require('../utils/safe-json')

function coerceTopLevelShape(value) {
  if (Array.isArray(value)) {
    return {
      value: {
        candidates: value
      },
      warning: 'top_level_array_wrapped_into_candidates'
    }
  }

  if (isPlainObject(value) && isPlainObject(value.candidates)) {
    return {
      value: {
        ...value,
        candidates: [value.candidates]
      },
      warning: 'single_candidate_object_wrapped_into_array'
    }
  }

  return {
    value,
    warning: null
  }
}

function tryParseCandidate(candidateText, strategy, warnings = []) {
  const parsed = safeJsonParse(candidateText)

  if (!parsed.ok) {
    return null
  }

  const coerced = coerceTopLevelShape(parsed.value)

  return {
    ok: true,
    value: coerced.value,
    repairedText: candidateText,
    strategy,
    warnings: coerced.warning ? [...warnings, coerced.warning] : warnings
  }
}

function repairJson(rawText) {
  const source = normalizeJsonText(rawText)
  const warnings = []

  if (!source) {
    return {
      ok: false,
      value: null,
      repairedText: null,
      strategy: null,
      warnings,
      error: 'empty_response'
    }
  }

  const strippedFences = stripMarkdownCodeFences(source)
  if (strippedFences !== source) {
    const repaired = tryParseCandidate(
      strippedFences,
      'strip_markdown_fences',
      [...warnings, 'markdown_fences_removed']
    )

    if (repaired) {
      return repaired
    }
  }

  const extractedFragment = findBalancedJsonFragment(strippedFences)
  if (extractedFragment && extractedFragment !== strippedFences) {
    const repaired = tryParseCandidate(
      extractedFragment,
      'extract_json_fragment',
      [...warnings, 'non_json_text_removed']
    )

    if (repaired) {
      return repaired
    }
  }

  const fragmentOrSource = extractedFragment || strippedFences
  const withoutTrailingCommas = stripTrailingCommas(fragmentOrSource)
  if (withoutTrailingCommas && withoutTrailingCommas !== fragmentOrSource) {
    const repaired = tryParseCandidate(
      withoutTrailingCommas,
      'strip_trailing_commas',
      [...warnings, 'trailing_commas_removed']
    )

    if (repaired) {
      return repaired
    }
  }

  const balanced = appendMissingClosers(fragmentOrSource)
  if (balanced && balanced !== fragmentOrSource) {
    const repaired = tryParseCandidate(
      balanced,
      'append_missing_closers',
      [...warnings, 'missing_json_closers_appended']
    )

    if (repaired) {
      return repaired
    }
  }

  return {
    ok: false,
    value: null,
    repairedText: null,
    strategy: null,
    warnings,
    error: 'json_repair_failed'
  }
}

module.exports = {
  repairJson
}
