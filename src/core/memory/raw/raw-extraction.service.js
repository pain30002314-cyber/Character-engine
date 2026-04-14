const logger = require('../../../services/logger.service')
const extractionSettings = require('./extraction.settings')
const { runLlmRawExtraction } = require('./strategies/llm.strategy')

async function runRawExtraction({ threadId, event }) {
  const requestedMode = extractionSettings.mode

  const packet = await runLlmRawExtraction({
    threadId,
    event
  })

  if (extractionSettings.debugLog) {
    logger.debug('Raw extraction packet built', {
      requestedMode,
      effectiveMode: 'llm_only',
      strategy: packet?.strategy,
      claims: packet?.claims?.length || 0,
      threadId
    })
  }

  return {
    ...packet,
    meta: {
      ...(packet?.meta || {}),
      requestedMode,
      effectiveMode: 'llm_only',
      regexExcludedFromMemoryPipeline: true
    }
  }
}

module.exports = {
  runRawExtraction
}