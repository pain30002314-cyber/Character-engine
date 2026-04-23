'use strict'

const { LOG_STAGES } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

async function logRouting({
  traceId = null,
  eventId = null,
  threadId = null,
  status = 'pending',
  durationMs = null,
  warnings = [],
  errors = [],
  counts = {},
  note = null,
  targets = [],
  skippedTargets = []
} = {}) {
  return writeStageLog({
    stage: LOG_STAGES.ROUTING,
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
      targets: Array.isArray(targets) ? targets : [],
      skippedTargets: Array.isArray(skippedTargets) ? skippedTargets : []
    }
  })
}

module.exports = {
  logRouting
}
