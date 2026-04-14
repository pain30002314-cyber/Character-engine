'use strict'

async function runHeuristicRawExtraction({ threadId, event }) {
  return {
    version: 2,
    strategy: 'heuristic_retired_v1',
    eventId: event?.id || null,
    threadId: threadId || event?.threadId || null,
    createdAt: new Date().toISOString(),
    claims: [],
    temporal: null,
    meta: {
      mode: 'heuristic_only',
      retired: true,
      reason: 'regex_removed_from_memory_pipeline'
    }
  }
}

module.exports = {
  runHeuristicRawExtraction
}