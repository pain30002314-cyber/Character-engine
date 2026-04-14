'use strict'

const { runLlmRawExtraction } = require('./llm.strategy')

async function runHybridRawExtraction({ threadId, event }) {
  const packet = await runLlmRawExtraction({
    threadId,
    event
  })

  return {
    ...packet,
    strategy: 'llm_only_bridge_v1',
    meta: {
      ...(packet?.meta || {}),
      requestedStrategy: 'hybrid',
      effectiveStrategy: 'llm_only',
      regexExcludedFromHybrid: true
    }
  }
}

module.exports = {
  runHybridRawExtraction
}