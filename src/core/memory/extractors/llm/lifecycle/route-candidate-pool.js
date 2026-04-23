'use strict'

const { getNowIso } = require('../utils/time')
const {
  LIFECYCLE_STATUSES
} = require('../registries/lifecycle-status.registry')
const {
  ROUTING_TARGETS,
  uniqTargets,
  createEmptyRouteGroups
} = require('./lifecycle-routing-targets')
const {
  ensureLifecycleCandidate,
  appendRoutingHistory,
  updateLifecycleStatus
} = require('./lifecycle-history')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function resolveRouteAction(target) {
  switch (target) {
    case ROUTING_TARGETS.NODE_RESOLUTION:
      return 'routed_to_node_resolution'
    case ROUTING_TARGETS.FACT_RESOLUTION:
      return 'routed_to_fact_resolution'
    case ROUTING_TARGETS.EPISODE_RESOLUTION:
      return 'routed_to_episode_resolution'
    case ROUTING_TARGETS.EDGE_RESOLUTION:
      return 'routed_to_edge_resolution'
    case ROUTING_TARGETS.DERIVED_INPUT:
      return 'routed_to_derived_input'
    case ROUTING_TARGETS.REFLECTION_QUEUE:
      return 'routed_to_reflection_queue'
    case ROUTING_TARGETS.STAGE_ONLY:
      return 'routed_to_stage_only'
    case ROUTING_TARGETS.DISCARD:
      return 'discarded'
    case ROUTING_TARGETS.ARCHIVE:
      return 'archived'
    default:
      return 'routed'
  }
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1
}

function routeCandidatePool(candidatePool = {}) {
  const timestamp = getNowIso()
  const routeGroups = createEmptyRouteGroups()
  const routedCandidates = []
  const targetCounts = {}
  let routedCount = 0
  let skippedCount = 0

  for (const candidate of safeArray(candidatePool?.candidates)) {
    const next = ensureLifecycleCandidate(candidate)
    const triageTargets = uniqTargets(next?.triageTargets)
    const routeTargets = uniqTargets(
      triageTargets.length > 0 ? triageTargets : next?.routingTargets
    )

    if (next.lifecycleStatus === LIFECYCLE_STATUSES.DISCARDED) {
      routeGroups[ROUTING_TARGETS.DISCARD].push(next)
      increment(targetCounts, ROUTING_TARGETS.DISCARD)
      skippedCount += 1
      routedCandidates.push(next)
      continue
    }

    if (next.lifecycleStatus === LIFECYCLE_STATUSES.ARCHIVED) {
      routeGroups[ROUTING_TARGETS.ARCHIVE].push(next)
      increment(targetCounts, ROUTING_TARGETS.ARCHIVE)
      skippedCount += 1
      routedCandidates.push(next)
      continue
    }

    const resolvedTargets =
      routeTargets.length > 0 ? routeTargets : [ROUTING_TARGETS.STAGE_ONLY]

    let routedCandidate = updateLifecycleStatus(next, LIFECYCLE_STATUSES.ROUTED, {
      stage: 'routing',
      action: resolveRouteAction(resolvedTargets[0]),
      target: resolvedTargets[0],
      timestamp,
      patch: {
        triageTargets: resolvedTargets,
        routingTargets: resolvedTargets
      }
    })

    for (let index = 1; index < resolvedTargets.length; index += 1) {
      routedCandidate = appendRoutingHistory(routedCandidate, {
        stage: 'routing',
        action: resolveRouteAction(resolvedTargets[index]),
        target: resolvedTargets[index],
        timestamp
      })
    }

    routedCount += 1
    routedCandidates.push(routedCandidate)

    for (const target of resolvedTargets) {
      routeGroups[target].push(routedCandidate)
      increment(targetCounts, target)
    }
  }

  return {
    ...candidatePool,
    candidates: routedCandidates,
    routeGroups,
    lifecycle: {
      ...(candidatePool?.lifecycle || {}),
      routing: {
        status: 'completed',
        timestamp,
        routedCandidateCount: routedCount,
        skippedCandidateCount: skippedCount,
        targetCounts
      }
    }
  }
}

module.exports = {
  routeCandidatePool
}
