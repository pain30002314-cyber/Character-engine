'use strict'

const { normalizeInlineText } = require('../utils/text')
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
  ensureMergeHistory,
  updateLifecycleStatus
} = require('./lifecycle-history')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function hasMeaningfulText(candidate) {
  return Boolean(
    normalizeInlineText(candidate?.summary) || normalizeInlineText(candidate?.text)
  )
}

function hasMeaningfulKind(candidate) {
  const kind = String(candidate?.kind || '').trim()
  return Boolean(kind && kind !== 'unknown_candidate_kind')
}

function hasMeaningfulPayload(candidate) {
  return (
    candidate?.payload &&
    typeof candidate.payload === 'object' &&
    !Array.isArray(candidate.payload) &&
    Object.keys(candidate.payload).length > 0
  )
}

function detectDiscardReason(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return 'candidate_not_object'
  }

  if (!hasMeaningfulText(candidate) && !hasMeaningfulKind(candidate) && !hasMeaningfulPayload(candidate)) {
    return 'candidate_missing_kind_and_signal_text'
  }

  if (
    !hasMeaningfulText(candidate) &&
    !hasMeaningfulPayload(candidate) &&
    safeArray(candidate?.tags).length === 0 &&
    safeArray(candidate?.relatedCandidateIds).length === 0
  ) {
    return 'candidate_missing_memory_signal'
  }

  return null
}

function stageCandidatePool(candidatePool = {}) {
  const timestamp = getNowIso()
  const stagedCandidates = []
  let stagedCount = 0
  let discardedCount = 0

  for (const candidate of safeArray(candidatePool?.candidates)) {
    const withMergeHistory = ensureMergeHistory(
      ensureLifecycleCandidate(candidate),
      candidate?.createdAt || timestamp
    )
    const discardReason = detectDiscardReason(withMergeHistory)

    if (discardReason) {
      discardedCount += 1
      stagedCandidates.push(
        updateLifecycleStatus(withMergeHistory, LIFECYCLE_STATUSES.DISCARDED, {
          stage: 'stage',
          action: 'discarded',
          target: ROUTING_TARGETS.DISCARD,
          note: discardReason,
          timestamp,
          patch: {
            discardReason,
            archiveReason: null,
            routingTargets: [ROUTING_TARGETS.DISCARD]
          }
        })
      )
      continue
    }

    stagedCount += 1
    stagedCandidates.push(
      updateLifecycleStatus(withMergeHistory, LIFECYCLE_STATUSES.STAGED, {
        stage: 'stage',
        action: 'staged',
        target: ROUTING_TARGETS.STAGE_ONLY,
        timestamp,
        patch: {
          discardReason: null,
          archiveReason: null,
          routingTargets: uniqTargets([
            ...safeArray(withMergeHistory?.routingTargets),
            ROUTING_TARGETS.STAGE_ONLY
          ])
        }
      })
    )
  }

  return {
    ...candidatePool,
    candidates: stagedCandidates,
    lifecycle: {
      ...(candidatePool?.lifecycle || {}),
      stage: {
        status: 'completed',
        timestamp,
        inputCandidateCount: safeArray(candidatePool?.candidates).length,
        stagedCandidateCount: stagedCount,
        discardedCandidateCount: discardedCount
      }
    }
  }
}

module.exports = {
  stageCandidatePool
}
