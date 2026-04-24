'use strict'

const { LLM_LOGGING_CONFIG } = require('../config/logging.config')
const { buildJsonPreview } = require('../utils/preview')
const { LOG_STAGES } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function previewLimit() {
  return LLM_LOGGING_CONFIG.previewLimits.candidatePreviewItems
}

function buildCandidateIndex(candidates = []) {
  const index = new Map()

  safeArray(candidates).forEach((candidate, position) => {
    const candidateId = candidate?.candidateId || candidate?.id || `index:${position}`
    index.set(candidateId, candidate)
  })

  return index
}

function buildCandidateDiffPreview(inputCandidates = [], outputCandidates = []) {
  const inputIndex = buildCandidateIndex(inputCandidates)

  return safeArray(outputCandidates)
    .map((candidate, position) => {
      const candidateId = candidate?.candidateId || candidate?.id || `index:${position}`
      const previous = inputIndex.get(candidateId) || {}
      const changedFields = safeArray(candidate?.normalization?.changedFields)

      if (changedFields.length === 0) {
        return null
      }

      return {
        candidateId,
        changedFields,
        before: {
          kind: previous?.rawKind || previous?.kind || null,
          importance: previous?.rawImportance || previous?.importance || null,
          tags: safeArray(previous?.rawTags || previous?.tags)
        },
        after: {
          kind: candidate?.kind || null,
          importance: candidate?.importance || null,
          tags: safeArray(candidate?.tags)
        },
        payloadPreview: {
          before: buildJsonPreview(previous?.rawPayload || previous?.payload || {}),
          after: buildJsonPreview(candidate?.payload || {})
        }
      }
    })
    .filter(Boolean)
    .slice(0, previewLimit())
}

function buildImportanceNormalizationPreview(inputCandidates = [], outputCandidates = []) {
  const inputIndex = buildCandidateIndex(inputCandidates)

  return safeArray(outputCandidates)
    .map((candidate, position) => {
      const candidateId = candidate?.candidateId || candidate?.id || `index:${position}`
      const previous = inputIndex.get(candidateId) || {}
      const rawImportance = previous?.rawImportance || previous?.importance || null
      const normalizedImportance = candidate?.importance || null

      if (rawImportance === normalizedImportance && !candidate?.rawImportance) {
        return null
      }

      return {
        candidateId,
        rawImportance,
        normalizedImportance
      }
    })
    .filter(Boolean)
    .slice(0, previewLimit())
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
  inputCandidates = [],
  outputCandidates = [],
  warnings = [],
  errors = [],
  note = null
} = {}) {
  const importancePreview = buildImportanceNormalizationPreview(
    inputCandidates,
    outputCandidates
  )

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
      payloadUnstableCount,
      candidateDiffPreview: buildCandidateDiffPreview(
        inputCandidates,
        outputCandidates
      ),
      importanceNormalizationPreview: importancePreview,
      rawImportanceNormalizedImportancePreview: importancePreview
    }
  })
}

module.exports = {
  logNormalization
}
