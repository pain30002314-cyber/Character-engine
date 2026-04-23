'use strict'

const { getNowIso } = require('../utils/time')
const {
  LIFECYCLE_STATUSES,
  isKnownLifecycleStatus
} = require('../registries/lifecycle-status.registry')
const { uniqTargets } = require('./lifecycle-routing-targets')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function buildHistoryEntry({
  stage,
  action,
  target = null,
  timestamp = getNowIso(),
  note = null
} = {}) {
  return {
    stage: stage || 'unknown',
    action: action || 'updated',
    target: target || null,
    timestamp,
    note: note == null ? null : String(note)
  }
}

function ensureLifecycleCandidate(candidate = {}) {
  return {
    ...(candidate && typeof candidate === 'object' ? candidate : {}),
    lifecycleStatus: isKnownLifecycleStatus(candidate?.lifecycleStatus)
      ? candidate.lifecycleStatus
      : null,
    lifecycleUpdatedAt: candidate?.lifecycleUpdatedAt || null,
    routingTargets: uniqTargets(candidate?.routingTargets),
    routingHistory: safeArray(candidate?.routingHistory),
    persistedTargets: uniqTargets(candidate?.persistedTargets),
    discardReason: candidate?.discardReason || null,
    archiveReason: candidate?.archiveReason || null
  }
}

function appendRoutingHistory(candidate, entryInput = {}) {
  const next = ensureLifecycleCandidate(candidate)
  const entry = buildHistoryEntry(entryInput)

  return {
    ...next,
    routingHistory: [...next.routingHistory, entry]
  }
}

function hasHistoryAction(candidate, stage, action) {
  return safeArray(candidate?.routingHistory).some(
    (entry) => entry?.stage === stage && entry?.action === action
  )
}

function ensureMergeHistory(candidate, timestamp = null) {
  const next = ensureLifecycleCandidate(candidate)

  if (hasHistoryAction(next, 'merge', 'merged')) {
    return next
  }

  return appendRoutingHistory(next, {
    stage: 'merge',
    action: 'merged',
    target: null,
    timestamp: timestamp || next.lifecycleUpdatedAt || next.createdAt || getNowIso()
  })
}

function updateLifecycleStatus(
  candidate,
  status = LIFECYCLE_STATUSES.STAGED,
  {
    stage = 'lifecycle',
    action = 'updated',
    target = null,
    note = null,
    timestamp = getNowIso(),
    patch = {}
  } = {}
) {
  const next = appendRoutingHistory(candidate, {
    stage,
    action,
    target,
    note,
    timestamp
  })

  return {
    ...next,
    ...patch,
    lifecycleStatus: status,
    lifecycleUpdatedAt: timestamp
  }
}

module.exports = {
  buildHistoryEntry,
  ensureLifecycleCandidate,
  appendRoutingHistory,
  ensureMergeHistory,
  updateLifecycleStatus
}
