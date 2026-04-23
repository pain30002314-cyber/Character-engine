'use strict'

const LLM_NORMALIZATION_CONFIG = Object.freeze({
  lowerCaseText: true,
  replaceYoWithE: true,
  collapseInnerWhitespace: true,
  tagSpacingStrategy: 'preserve_spaces',
  unknownKindFallback: 'unknown_candidate_kind',
  allowedImportanceValues: Object.freeze(['низкая', 'средняя', 'высокая']),
  payload: Object.freeze({
    maxDepth: 4,
    maxObjectKeys: 32,
    maxArrayLength: 24,
    maxStringLength: 400
  })
})

module.exports = {
  LLM_NORMALIZATION_CONFIG
}
