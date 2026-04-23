'use strict'

const {
  safeJsonParse,
  normalizeJsonText
} = require('../utils/safe-json')

function parseJson(rawText) {
  const normalizedText = normalizeJsonText(rawText)

  if (!normalizedText) {
    return {
      ok: false,
      value: null,
      normalizedText,
      error: 'empty_response'
    }
  }

  const parsed = safeJsonParse(normalizedText)

  if (!parsed.ok) {
    return {
      ok: false,
      value: null,
      normalizedText,
      error: parsed.error?.message || 'json_parse_failed'
    }
  }

  return {
    ok: true,
    value: parsed.value,
    normalizedText,
    error: null
  }
}

module.exports = {
  parseJson
}
