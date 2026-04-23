'use strict'

const ROUTING_TARGETS = Object.freeze({
  NODE_RESOLUTION: 'node_resolution',
  FACT_RESOLUTION: 'fact_resolution',
  EPISODE_RESOLUTION: 'episode_resolution',
  EDGE_RESOLUTION: 'edge_resolution',
  STAGE_ONLY: 'stage_only',
  DERIVED_INPUT: 'derived_input',
  REFLECTION_QUEUE: 'reflection_queue',
  DISCARD: 'discard',
  ARCHIVE: 'archive'
})

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function uniqTargets(targets = []) {
  return Array.from(new Set(safeArray(targets).filter(Boolean)))
}

function isKnownRoutingTarget(value) {
  return Object.values(ROUTING_TARGETS).includes(String(value || '').trim())
}

function createEmptyRouteGroups() {
  return Object.values(ROUTING_TARGETS).reduce((accumulator, target) => {
    accumulator[target] = []
    return accumulator
  }, {})
}

module.exports = {
  ROUTING_TARGETS,
  uniqTargets,
  isKnownRoutingTarget,
  createEmptyRouteGroups
}
