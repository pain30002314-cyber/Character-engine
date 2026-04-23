'use strict'

const { logPassRun } = require('../logging/log-pass-run')
const { writeFailureLog } = require('../logging/write-failure-log')
const { getExtractorLogStage } = require('../registries/log-stage.registry')
const { classifyFailure } = require('./classify-failure')
const { shouldRetry, MAX_PASS_RETRIES } = require('./should-retry')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function uniq(list = []) {
  return Array.from(new Set(safeArray(list).filter(Boolean)))
}

function toErrorMessages(error, extraErrors = []) {
  return uniq([
    error?.message || (error ? String(error) : null),
    ...safeArray(extraErrors)
  ])
}

function buildFailedPassResult({
  pass,
  event,
  traceId = null,
  llmCall = {},
  rawResponseText = '',
  repairedJson = null,
  parsedResponse = null,
  validation = null,
  baseEventPacket = null,
  promptPacket = null,
  durationMs = 0,
  retryCount = 0,
  eventWindowSize = 0,
  warnings = [],
  errors = [],
  failure
}) {
  const failureType = failure?.type || 'unknown_failure'

  return {
    traceId,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    sourcePass: pass?.extractorKey || null,
    extractorKey: pass?.extractorKey || null,
    extractorName: pass?.extractorName || null,
    role: pass?.role || null,
    status: 'failed',
    rawResponseText,
    repairedJson,
    candidates: [],
    warnings: uniq(warnings),
    errors: uniq(errors),
    durationMs: Math.max(0, Number(durationMs || 0)),
    baseEventPacket,
    promptPacket,
    llmCall,
    parsedResponse,
    validation,
    retryCount: Math.max(0, Number(retryCount || 0)),
    failure,
    error: {
      message: uniq(errors)[0] || failure?.message || 'pass_failed',
      code: failure?.code || failureType,
      type: failureType,
      retryable: failure?.retryable === true
    },
    stats: {
      eventWindowSize: Math.max(0, Number(eventWindowSize || 0)),
      parsedCandidateCount: validation?.stats?.parsedCandidateCount || 0,
      validCandidateCount: validation?.stats?.validCandidateCount || 0,
      droppedCandidateCount: validation?.stats?.droppedCandidateCount || 0,
      candidateCount: 0
    }
  }
}

async function handlePassFailure({
  pass,
  event,
  traceId = null,
  error = null,
  llmCall = {},
  rawResponseText = '',
  repairedJson = null,
  parsedResponse = null,
  validation = null,
  initialParse = null,
  repairResult = null,
  baseEventPacket = null,
  promptPacket = null,
  durationMs = 0,
  retryCount = 0,
  maxRetries = MAX_PASS_RETRIES,
  eventWindowSize = 0,
  warnings = [],
  errors = []
} = {}) {
  const classification = classifyFailure({
    error,
    validation,
    initialParse,
    repairResult,
    warnings,
    errors
  })

  const retryDecision = shouldRetry({
    failureType: classification.type,
    error,
    retryCount,
    maxRetries
  })

  if (retryDecision.retry) {
    return {
      action: 'retry',
      retryDecision,
      failure: classification
    }
  }

  const finalFailure = retryDecision.retryableTransport
    ? classifyFailure({
        error,
        validation,
        initialParse,
        repairResult,
        warnings,
        errors,
        retryExhausted: retryCount >= maxRetries
      })
    : classification

  const failedResult = buildFailedPassResult({
    pass,
    event,
    traceId,
    llmCall,
    rawResponseText,
    repairedJson,
    parsedResponse,
    validation,
    baseEventPacket,
    promptPacket,
    durationMs,
    retryCount,
    eventWindowSize,
    warnings,
    errors: toErrorMessages(error, errors),
    failure: finalFailure
  })

  await logPassRun({
    traceId: failedResult.traceId,
    eventId: failedResult.eventId,
    threadId: failedResult.threadId,
    extractorName: failedResult.extractorName,
    sourcePass: failedResult.sourcePass,
    status: failedResult.status,
    durationMs: failedResult.durationMs,
    model: failedResult.llmCall?.model || null,
    promptLanguage:
      failedResult.promptPacket?.promptLanguage ||
      failedResult.baseEventPacket?.promptLanguageCode ||
      null,
    retryCount: failedResult.retryCount,
    promptPreview: failedResult.promptPacket?.prompt || null,
    rawResponseText: failedResult.rawResponseText,
    repairedJson: failedResult.repairedJson,
    parsedCandidateCount: failedResult.stats.parsedCandidateCount,
    validCandidateCount: failedResult.stats.validCandidateCount,
    droppedCandidateCount: failedResult.stats.droppedCandidateCount,
    candidatePreview: [],
    warnings: failedResult.warnings,
    errors: failedResult.errors,
    counts: {
      candidateCount: 0
    },
    note: finalFailure.type
  })

  await writeFailureLog({
    traceId: failedResult.traceId,
    eventId: failedResult.eventId,
    threadId: failedResult.threadId,
    failedStage: getExtractorLogStage(pass?.extractorKey) || pass?.extractorKey,
    extractorName: failedResult.extractorName,
    sourcePass: failedResult.sourcePass,
    status: failedResult.status,
    durationMs: failedResult.durationMs,
    warnings: failedResult.warnings,
    errors: failedResult.errors,
    counts: {
      retryCount: failedResult.retryCount,
      parsedCandidateCount: failedResult.stats.parsedCandidateCount,
      validCandidateCount: failedResult.stats.validCandidateCount,
      droppedCandidateCount: failedResult.stats.droppedCandidateCount
    },
    note: finalFailure.type,
    error,
    details: finalFailure.details
  })

  return {
    action: 'return',
    retryDecision,
    failure: finalFailure,
    result: failedResult
  }
}

module.exports = {
  handlePassFailure
}
