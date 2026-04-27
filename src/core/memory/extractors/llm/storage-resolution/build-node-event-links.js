'use strict'

const { buildResolutionId } = require('./helpers')

function buildNodeEventLinks({
  candidatePool = {},
  nodeResolutions = []
} = {}) {
  return (Array.isArray(nodeResolutions) ? nodeResolutions : []).map((item, index) => ({
    linkId: buildResolutionId(
      'node_event_link',
      {
        candidateId: item?.candidateId || `candidate:${index}`
      },
      item?.nodeResolutionId || 'node'
    ),
    nodeResolutionId: item?.nodeResolutionId || null,
    candidateId: item?.candidateId || null,
    traceId: item?.provenance?.traceId || candidatePool?.traceId || null,
    threadId: item?.provenance?.threadId || candidatePool?.threadId || null,
    eventId: item?.provenance?.eventId || candidatePool?.eventId || null,
    linkRole:
      item?.candidateKind === 'alias_signal' || item?.candidateKind === 'role_signal'
        ? 'support'
        : 'mention',
    positionIndex: index,
    provenance: item?.provenance || null
  }))
}

module.exports = {
  buildNodeEventLinks
}
