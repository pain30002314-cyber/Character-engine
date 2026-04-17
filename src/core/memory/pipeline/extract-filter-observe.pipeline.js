'use strict'

const memoryConfig = require('../memory.config')
const { extractLlmAtomsV1 } = require('../extractors/llm')
const { evaluateLlmCandidateBatchV1 } = require('../filters/llm')
const { getThreadEvents } = require('../store/events.store')
const { buildEventWindow } = require('./event-window')

async function runExtractFilterObservePipeline({ threadId, event }) {
  const resolvedThreadId = threadId || event?.threadId || null
  const history = resolvedThreadId
    ? getThreadEvents(resolvedThreadId, { includeInvalidForMemory: true })
    : []

  const filteredHistory = Array.isArray(history)
    ? history.filter((item) => item?.id !== event?.id)
    : []

  const eventWindow = buildEventWindow(
    filteredHistory,
    memoryConfig.limits.rawContextEvents,
    memoryConfig.limits.rawContextCharsPerEvent
  )

  const extractorPacket = await extractLlmAtomsV1({
    event,
    eventWindow
  })

  const filterPacket = await evaluateLlmCandidateBatchV1({
    extractorPacket
  })

  return {
    eventWindow,
    extractorPacket,
    filterPacket
  }
}

module.exports = {
  runExtractFilterObservePipeline
}
