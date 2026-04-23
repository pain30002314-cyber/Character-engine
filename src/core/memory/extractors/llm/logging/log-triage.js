'use strict'

const { LOG_STAGES } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

async function logTriage({
  traceId = null,
  eventId = null,
  threadId = null,
  status = 'pending',
  durationMs = null,
  warnings = [],
  errors = [],
  counts = {},
  note = null,
  decisions = [],
  routedCandidateCount = null,
  deferredCandidateCount = null
} = {}) {
  return writeStageLog({
    stage: LOG_STAGES.TRIAGE,
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
      counts,
      note,
      decisions: Array.isArray(decisions) ? decisions : [],
      routedCandidateCount,
      deferredCandidateCount
    }
  })
}

module.exports = {
  logTriage
}
