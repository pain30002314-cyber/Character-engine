'use strict'

const path = require('node:path')

const LOG_ROOT_DIR = path.resolve(process.cwd(), 'logs', 'memory')

const LOG_FILE_BY_STAGE = Object.freeze({
  'base-packet': 'base-packet.jsonl',
  'extractor-entity_object_location': 'extractor-entity_object_location.jsonl',
  'extractor-fact': 'extractor-fact.jsonl',
  'extractor-episode': 'extractor-episode.jsonl',
  'extractor-phase_open_loop': 'extractor-phase_open_loop.jsonl',
  'extractor-cognition_realization': 'extractor-cognition_realization.jsonl',
  'extractor-emotion_atmosphere_significance':
    'extractor-emotion_atmosphere_significance.jsonl',
  'extractor-relationship_social': 'extractor-relationship_social.jsonl',
  normalization: 'normalization.jsonl',
  merge: 'merge.jsonl',
  triage: 'triage.jsonl',
  routing: 'routing.jsonl',
  persistence: 'persistence.jsonl',
  derived: 'derived.jsonl',
  failures: 'failures.jsonl'
})

const LLM_LOGGING_CONFIG = Object.freeze({
  logVersion: '1.0.0',
  appendOnly: true,
  lineDelimiter: '\n',
  rootDir: LOG_ROOT_DIR,
  devConsolePreview: false,
  rotationFriendly: Object.freeze({
    mode: 'external',
    fileExtension: '.jsonl'
  }),
  previewLimits: Object.freeze({
    promptChars: 1600,
    candidatePreviewItems: 5,
    candidateTextChars: 220,
    mergeActionPreviewItems: 12,
    mergeActionChars: 220,
    messageChars: 4000,
    noteChars: 800
  }),
  files: LOG_FILE_BY_STAGE
})

function resolveLogFileByStage(stage) {
  return LOG_FILE_BY_STAGE[String(stage || '').trim()] || null
}

function resolveLogPathByStage(stage) {
  const fileName = resolveLogFileByStage(stage)
  return fileName ? path.join(LOG_ROOT_DIR, fileName) : null
}

module.exports = {
  LLM_LOGGING_CONFIG,
  LOG_ROOT_DIR,
  LOG_FILE_BY_STAGE,
  resolveLogFileByStage,
  resolveLogPathByStage
}
