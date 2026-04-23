'use strict'

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function uniq(list = []) {
  return Array.from(new Set(safeArray(list).filter(Boolean)))
}

function buildPartialPassResult({
  pass,
  event,
  traceId = null,
  candidates = [],
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
  failureType = 'partial_success'
} = {}) {
  return {
    traceId,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    sourcePass: pass?.extractorKey || null,
    extractorKey: pass?.extractorKey || null,
    extractorName: pass?.extractorName || null,
    role: pass?.role || null,
    status: 'partial',
    rawResponseText,
    repairedJson,
    candidates: safeArray(candidates),
    warnings: uniq(warnings),
    errors: uniq(errors),
    durationMs: Math.max(0, Number(durationMs || 0)),
    baseEventPacket,
    promptPacket,
    llmCall,
    parsedResponse,
    validation,
    retryCount: Math.max(0, Number(retryCount || 0)),
    failure: {
      type: failureType,
      retryable: false
    },
    stats: {
      eventWindowSize: Math.max(0, Number(eventWindowSize || 0)),
      parsedCandidateCount: validation?.stats?.parsedCandidateCount || 0,
      validCandidateCount: validation?.stats?.validCandidateCount || 0,
      droppedCandidateCount: validation?.stats?.droppedCandidateCount || 0,
      candidateCount: safeArray(candidates).length
    }
  }
}

module.exports = {
  buildPartialPassResult
}
