'use strict'

const { extractLlmAtomsV1 } = require('../extractors/llm')
const { evaluateLlmCandidateBatchV1 } = require('../filters/llm')
const { buildEventWindow } = require('./event-window')

const DEFAULT_PIPELINE_LIMITS = {
  rawContextEvents: 8,
  rawContextCharsPerEvent: 280
}

async function runExtractFilterObservePipeline({
  threadId,
  event,
  history = [],
  eventWindow = null,
  pipelineLimits = {},
  filterConfig = {}
}) {
  const resolvedLimits = {
    ...DEFAULT_PIPELINE_LIMITS,
    ...(pipelineLimits || {})
  }

  const resolvedThreadId = threadId || event?.threadId || null

  const filteredHistory = Array.isArray(history)
    ? history.filter((item) => item?.id !== event?.id)
    : []

  const resolvedEventWindow = Array.isArray(eventWindow)
    ? eventWindow
    : buildEventWindow(
        filteredHistory,
        resolvedLimits.rawContextEvents,
        resolvedLimits.rawContextCharsPerEvent
      )

  const extractorPacket = await extractLlmAtomsV1({
    event,
    eventWindow: resolvedEventWindow
  })

  const filterPacket = await evaluateLlmCandidateBatchV1({
    extractorPacket,
    config: filterConfig
  })

  return {
    thread_id: resolvedThreadId,
    eventWindow: resolvedEventWindow,
    extractorPacket,
    filterPacket
  }
}

module.exports = {
  runExtractFilterObservePipeline,
  DEFAULT_PIPELINE_LIMITS
}