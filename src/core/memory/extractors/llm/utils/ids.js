'use strict'

const crypto = require('node:crypto')

function stableHash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 16)
}

function randomId(prefix) {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}:${crypto.randomUUID()}`
  }

  return `${prefix}:${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createTraceId(prefix = 'llm_trace') {
  return randomId(prefix)
}

function createCandidateId({
  traceId,
  eventId,
  sourcePass,
  index,
  text
}) {
  return `llm_candidate:${sourcePass || 'unknown'}:${stableHash(
    `${traceId || 'trace'}::${eventId || 'event'}::${index}::${text || ''}`
  )}`
}

module.exports = {
  stableHash,
  createTraceId,
  createCandidateId
}
