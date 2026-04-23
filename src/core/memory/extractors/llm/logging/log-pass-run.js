'use strict'

const { trimText } = require('../utils/text')
const { LLM_LOGGING_CONFIG } = require('../config/logging.config')
const { getExtractorLogStage } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function buildCandidatePreview(candidates = []) {
  return safeArray(candidates)
    .slice(0, LLM_LOGGING_CONFIG.previewLimits.candidatePreviewItems)
    .map((candidate) => ({
      candidateId: candidate?.candidateId || candidate?.id || null,
      kind: candidate?.kind || null,
      summary: trimText(
        candidate?.summary || candidate?.text || '',
        LLM_LOGGING_CONFIG.previewLimits.candidateTextChars
      ),
      importance: candidate?.importance || null,
      tags: safeArray(candidate?.tags)
    }))
}

async function logPassRun({
  traceId = null,
  eventId = null,
  threadId = null,
  extractorName = null,
  sourcePass = null,
  status = 'unknown',
  durationMs = null,
  model = null,
  promptLanguage = null,
  retryCount = 0,
  promptPreview = null,
  rawResponseText = '',
  repairedJson = null,
  parsedCandidateCount = 0,
  validCandidateCount = 0,
  droppedCandidateCount = 0,
  candidatePreview = null,
  warnings = [],
  errors = [],
  counts = {},
  note = null
} = {}) {
  const stage = getExtractorLogStage(sourcePass)

  if (!stage) {
    return {
      ok: false,
      stage: null,
      filePath: null,
      reason: 'unknown_extractor_log_stage'
    }
  }

  return writeStageLog({
    stage,
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
        parsedCandidateCount,
        validCandidateCount,
        droppedCandidateCount,
        ...counts
      },
      note,
      model,
      promptLanguage,
      retryCount,
      promptPreview:
        promptPreview == null
          ? null
          : trimText(
              promptPreview,
              LLM_LOGGING_CONFIG.previewLimits.promptChars
            ),
      rawResponseText: String(rawResponseText || ''),
      repairedJson: repairedJson == null ? null : String(repairedJson),
      parsedCandidateCount,
      validCandidateCount,
      droppedCandidateCount,
      candidatePreview:
        candidatePreview == null
          ? buildCandidatePreview([])
          : safeArray(candidatePreview)
    }
  })
}

module.exports = {
  logPassRun,
  buildCandidatePreview
}
