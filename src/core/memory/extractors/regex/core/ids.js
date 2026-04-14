'use strict'

const crypto = require('node:crypto')

function stableHash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 16)
}

function buildCandidateId(type, clauseId, text) {
  return `${type}:${stableHash(`${clauseId}::${text}`)}`
}

function buildAtomId(type, subtype, sourceEventId, text) {
  return `${type}:${subtype || 'generic'}:${stableHash(`${sourceEventId}::${text}`)}`
}

function buildHintId(kind, sourceEventId, value) {
  return `hint:${kind}:${stableHash(`${sourceEventId}::${value}`)}`
}

module.exports = {
  stableHash,
  buildCandidateId,
  buildAtomId,
  buildHintId
}