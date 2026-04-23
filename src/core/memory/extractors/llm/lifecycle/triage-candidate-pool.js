'use strict'

const { getNowIso } = require('../utils/time')
const {
  LIFECYCLE_STATUSES
} = require('../registries/lifecycle-status.registry')
const {
  ROUTING_TARGETS,
  uniqTargets
} = require('./lifecycle-routing-targets')
const {
  ensureLifecycleCandidate,
  appendRoutingHistory,
  updateLifecycleStatus
} = require('./lifecycle-history')

const NODE_KINDS = new Set([
  'entity_candidate',
  'object_candidate',
  'location_candidate',
  'alias_candidate',
  'role_candidate'
])

const FACT_KINDS = new Set([
  'fact_candidate',
  'temporal_fact_candidate',
  'support_signal',
  'contradiction_signal',
  'refinement_signal'
])

const EPISODE_KINDS = new Set([
  'episode_candidate',
  'scene_candidate',
  'micro_scene_candidate',
  'micro_episode_candidate',
  'interaction_candidate',
  'progression_signal'
])

const PHASE_KINDS = new Set([
  'phase_transition',
  'phase_marker',
  'plan_marker',
  'milestone_signal',
  'open_loop_candidate',
  'deferred_topic',
  'pending_step',
  'dependency_signal'
])

const COGNITION_KINDS = new Set([
  'realization_signal',
  'cognitive_update',
  'reframing_signal',
  'interpretation_shift',
  'certainty_shift'
])

const EMOTION_KINDS = new Set([
  'emotional_state',
  'emotional_shift',
  'atmosphere_signal',
  'tone_signal',
  'significance_signal',
  'emphasis_signal'
])

const RELATIONSHIP_KINDS = new Set([
  'relationship_signal',
  'collaboration_signal',
  'vulnerability_signal',
  'openness_signal',
  'boundary_signal',
  'addressing_signal'
])

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1
}

function hasEdgeContext(candidate) {
  return (
    safeArray(candidate?.relatedCandidateIds).length > 0 ||
    safeArray(candidate?.relationToRelated).length > 0 ||
    candidate?.sourcePass === 'relationship-social'
  )
}

function resolveCandidateTargets(candidate) {
  const kind = String(candidate?.kind || '').trim()
  const sourcePass = String(candidate?.sourcePass || '').trim()
  const targets = [ROUTING_TARGETS.STAGE_ONLY]

  if (NODE_KINDS.has(kind) || sourcePass === 'entity-object-location') {
    targets.push(ROUTING_TARGETS.NODE_RESOLUTION)
    if (hasEdgeContext(candidate)) {
      targets.push(ROUTING_TARGETS.EDGE_RESOLUTION)
    }
    return uniqTargets(targets)
  }

  if (FACT_KINDS.has(kind) || sourcePass === 'fact') {
    targets.push(ROUTING_TARGETS.FACT_RESOLUTION)
    if (hasEdgeContext(candidate)) {
      targets.push(ROUTING_TARGETS.EDGE_RESOLUTION)
    }
    return uniqTargets(targets)
  }

  if (EPISODE_KINDS.has(kind) || sourcePass === 'episode') {
    targets.push(ROUTING_TARGETS.EPISODE_RESOLUTION, ROUTING_TARGETS.DERIVED_INPUT)
    if (hasEdgeContext(candidate)) {
      targets.push(ROUTING_TARGETS.EDGE_RESOLUTION)
    }
    return uniqTargets(targets)
  }

  if (PHASE_KINDS.has(kind) || sourcePass === 'phase-open-loop') {
    targets.push(ROUTING_TARGETS.DERIVED_INPUT)
    if (
      kind === 'open_loop_candidate' ||
      kind === 'deferred_topic' ||
      kind === 'pending_step' ||
      kind === 'dependency_signal' ||
      sourcePass === 'phase-open-loop'
    ) {
      targets.push(ROUTING_TARGETS.REFLECTION_QUEUE)
    }
    return uniqTargets(targets)
  }

  if (COGNITION_KINDS.has(kind) || sourcePass === 'cognition-realization') {
    targets.push(ROUTING_TARGETS.DERIVED_INPUT, ROUTING_TARGETS.REFLECTION_QUEUE)
    return uniqTargets(targets)
  }

  if (EMOTION_KINDS.has(kind) || sourcePass === 'emotion-atmosphere-significance') {
    targets.push(ROUTING_TARGETS.DERIVED_INPUT)
    if (
      kind === 'emotional_shift' ||
      kind === 'atmosphere_signal' ||
      kind === 'tone_signal' ||
      kind === 'significance_signal'
    ) {
      targets.push(ROUTING_TARGETS.EPISODE_RESOLUTION)
    }
    return uniqTargets(targets)
  }

  if (RELATIONSHIP_KINDS.has(kind) || sourcePass === 'relationship-social') {
    targets.push(ROUTING_TARGETS.EDGE_RESOLUTION, ROUTING_TARGETS.DERIVED_INPUT)
    return uniqTargets(targets)
  }

  return uniqTargets(targets)
}

function triageCandidatePool(candidatePool = {}) {
  const timestamp = getNowIso()
  const triagedCandidates = []
  const targetCounts = {}
  const decisions = []
  let triagedCount = 0
  let skippedCount = 0

  for (const candidate of safeArray(candidatePool?.candidates)) {
    const next = ensureLifecycleCandidate(candidate)

    if (
      next.lifecycleStatus === LIFECYCLE_STATUSES.DISCARDED ||
      next.lifecycleStatus === LIFECYCLE_STATUSES.ARCHIVED
    ) {
      skippedCount += 1
      triagedCandidates.push(next)
      continue
    }

    const triageTargets = resolveCandidateTargets(next)
    const triageHistoryTargets =
      triageTargets.length > 1
        ? triageTargets.filter((target) => target !== ROUTING_TARGETS.STAGE_ONLY)
        : triageTargets
    let triagedCandidate = updateLifecycleStatus(next, LIFECYCLE_STATUSES.TRIAGED, {
      stage: 'triage',
      action: 'triaged',
      target: triageHistoryTargets[0] || ROUTING_TARGETS.STAGE_ONLY,
      timestamp,
      patch: {
        triageTargets,
        routingTargets: uniqTargets([
          ...safeArray(next?.routingTargets),
          ...triageTargets
        ])
      }
    })

    for (let index = 1; index < triageHistoryTargets.length; index += 1) {
      triagedCandidate = appendRoutingHistory(triagedCandidate, {
        stage: 'triage',
        action: 'triaged',
        target: triageHistoryTargets[index],
        timestamp
      })
    }

    triagedCount += 1
    for (const target of triageTargets) {
      increment(targetCounts, target)
    }

    decisions.push({
      candidateId: triagedCandidate?.candidateId || triagedCandidate?.id || null,
      kind: triagedCandidate?.kind || null,
      sourcePass: triagedCandidate?.sourcePass || null,
      targets: triageTargets
    })
    triagedCandidates.push(triagedCandidate)
  }

  return {
    ...candidatePool,
    candidates: triagedCandidates,
    lifecycle: {
      ...(candidatePool?.lifecycle || {}),
      triage: {
        status: 'completed',
        timestamp,
        triagedCandidateCount: triagedCount,
        skippedCandidateCount: skippedCount,
        targetCounts,
        decisions
      }
    }
  }
}

module.exports = {
  triageCandidatePool
}
