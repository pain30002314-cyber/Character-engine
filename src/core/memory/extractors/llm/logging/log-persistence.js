'use strict'

const { LOG_STAGES } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

async function logPersistence({
  traceId = null,
  eventId = null,
  threadId = null,
  status = 'pending',
  durationMs = null,
  warnings = [],
  errors = [],
  counts = {},
  note = null,
  storageTarget = null,
  storedCandidateCount = null,
  rejectedCandidateCount = null,
  createdNodesCount = null,
  updatedNodesCount = null,
  createdFactsCount = null,
  updatedFactsCount = null,
  createdEpisodesCount = null,
  updatedEpisodesCount = null,
  createdEdgesCount = null,
  createdLinksCount = null,
  persistedTargetsPreview = []
} = {}) {
  return writeStageLog({
    stage: LOG_STAGES.PERSISTENCE,
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
      storageTarget,
      storedCandidateCount,
      rejectedCandidateCount,
      createdNodesCount,
      updatedNodesCount,
      createdFactsCount,
      updatedFactsCount,
      createdEpisodesCount,
      updatedEpisodesCount,
      createdEdgesCount,
      createdLinksCount,
      persistedTargetsPreview
    }
  })
}

module.exports = {
  logPersistence
}
