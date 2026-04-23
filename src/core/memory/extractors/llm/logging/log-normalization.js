'use strict'

const { LOG_STAGES } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

async function logNormalization({
  traceId = null,
  eventId = null,
  threadId = null,
  sourcePass = null,
  extractorName = null,
  status = 'completed',
  durationMs = null,
  inputCandidateCount = 0,
  outputCandidateCount = 0,
  changedFieldsSummary = {},
  unknownKinds = [],
  unstableImportanceCount = 0,
  cleanedTagsCount = 0,
  payloadUnstableCount = 0,
  warnings = [],
  errors = [],
  note = null
} = {}) {
  return writeStageLog({
    stage: LOG_STAGES.NORMALIZATION,
    entry: {
      traceId,
      eventId,
      threadId,
      status,
      extractorName,
      sourcePass,
      durationMs,
      warnings,
      errors,
      counts: {
        inputCandidateCount,
        outputCandidateCount,
        unknownKindCount: safeArray(unknownKinds).length,
        unstableImportanceCount,
        cleanedTagsCount,
        payloadUnstableCount
      },
      note,
      inputCandidateCount,
      outputCandidateCount,
      changedFieldsSummary:
        changedFieldsSummary && typeof changedFieldsSummary === 'object'
          ? changedFieldsSummary
          : {},
      unknownKinds: safeArray(unknownKinds),
      unstableImportanceCount,
      cleanedTagsCount,
      payloadUnstableCount
    }
  })
}

module.exports = {
  logNormalization
}
