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
  'alias_signal',
  'role_signal'
])

const FACT_KINDS = new Set([
  'fact_candidate',
  'temporal_fact_candidate',
  'fact_support_signal',
  'fact_contradiction_signal',
  'fact_refinement_signal'
])

const EPISODE_KINDS = new Set([
  'episode_candidate',
  'micro_episode_candidate',
  'situational_context_signal',
  'local_interaction_signal',
  'participant_signal',
  'scene_location_signal',
  'scene_progression_signal'
])

const PHASE_KINDS = new Set([
  'phase_transition_candidate',
  'phase_marker_signal',
  'plan_marker_signal',
  'milestone_signal',
  'open_loop_candidate',
  'deferred_topic_signal',
  'pending_step_signal',
  'dependency_signal'
])

const COGNITION_KINDS = new Set([
  'realization_candidate',
  'cognitive_update_candidate',
  'reframing_signal',
  'interpretation_shift_signal',
  'certainty_shift_signal'
])

const EMOTION_KINDS = new Set([
  'emotional_state_candidate',
  'emotional_shift_candidate',
  'atmosphere_candidate',
  'tone_signal',
  'significance_candidate',
  'emphasis_signal'
])

const RELATIONSHIP_KINDS = new Set([
  'relationship_candidate',
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
      kind === 'deferred_topic_signal' ||
      kind === 'pending_step_signal' ||
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
      kind === 'emotional_shift_candidate' ||
      kind === 'atmosphere_candidate' ||
      kind === 'tone_signal' ||
      kind === 'significance_candidate'
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
