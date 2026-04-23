'use strict'

const { trimText } = require('../utils/text')
const { LLM_LOGGING_CONFIG } = require('../config/logging.config')
const { LOG_STAGES } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function buildMergeActionsPreview(actions = []) {
  return safeArray(actions)
    .slice(0, LLM_LOGGING_CONFIG.previewLimits.mergeActionPreviewItems)
    .map((action) =>
      trimText(
        typeof action === 'string' ? action : JSON.stringify(action),
        LLM_LOGGING_CONFIG.previewLimits.mergeActionChars
      )
    )
}

async function logMerge({
  traceId = null,
  eventId = null,
  threadId = null,
  status = 'pending',
  durationMs = null,
  inputPassCount = 0,
  missingPasses = [],
  totalInputCandidates = 0,
  totalOutputCandidates = null,
  duplicateGroups = 0,
  overlapGroups = 0,
  conflictGroups = 0,
  mergeActionsPreview = [],
  warnings = [],
  errors = [],
  note = null
} = {}) {
  return writeStageLog({
    stage: LOG_STAGES.MERGE,
    entry: {
      traceId,
      eventId,
      threadId,
      status,
      extractorName: null,
      sourcePass: null,
      durationMs,
      warnings,
      errors,
      counts: {
        inputPassCount,
        missingPassCount: safeArray(missingPasses).length,
        totalInputCandidates,
        totalOutputCandidates:
          totalOutputCandidates == null ? null : Number(totalOutputCandidates),
        duplicateGroups,
        overlapGroups,
        conflictGroups
      },
      note,
      inputPassCount,
      missingPasses: safeArray(missingPasses),
      totalInputCandidates,
      totalOutputCandidates:
        totalOutputCandidates == null ? null : Number(totalOutputCandidates),
      duplicateGroups,
      overlapGroups,
      conflictGroups,
      mergeActionsPreview: buildMergeActionsPreview(mergeActionsPreview)
    }
  })
}

module.exports = {
  logMerge
}
