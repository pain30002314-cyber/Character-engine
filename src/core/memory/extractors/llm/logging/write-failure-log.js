'use strict'

const { LOG_STAGES } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function toErrorMessages(error, fallbackErrors = []) {
  const messages = safeArray(fallbackErrors)

  if (error?.message) {
    messages.unshift(error.message)
  } else if (error) {
    messages.unshift(String(error))
  }

  return Array.from(new Set(messages.filter(Boolean)))
}

async function writeFailureLog({
  traceId = null,
  eventId = null,
  threadId = null,
  failedStage = null,
  extractorName = null,
  sourcePass = null,
  status = 'failed',
  durationMs = null,
  warnings = [],
  errors = [],
  counts = {},
  note = null,
  error = null,
  details = null
} = {}) {
  return writeStageLog({
    stage: LOG_STAGES.FAILURES,
    entry: {
      traceId,
      eventId,
      threadId,
      status,
      failedStage: failedStage || null,
      extractorName,
      sourcePass,
      durationMs,
      warnings,
      errors: toErrorMessages(error, errors),
      counts,
      note,
      details
    }
  })
}

module.exports = {
  writeFailureLog
}
