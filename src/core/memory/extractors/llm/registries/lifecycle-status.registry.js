'use strict'

const LIFECYCLE_STATUSES = Object.freeze({
  EXTRACTED: 'extracted',
  NORMALIZED: 'normalized',
  MERGED: 'merged',
  STAGED: 'staged',
  TRIAGED: 'triaged',
  ROUTED: 'routed',
  PERSISTED: 'persisted',
  DERIVED_USED: 'derived_used',
  DISCARDED: 'discarded',
  ARCHIVED: 'archived'
})

function isKnownLifecycleStatus(value) {
  return Object.values(LIFECYCLE_STATUSES).includes(String(value || '').trim())
}

function isTerminalLifecycleStatus(value) {
  const normalized = String(value || '').trim()

  return (
    normalized === LIFECYCLE_STATUSES.DISCARDED ||
    normalized === LIFECYCLE_STATUSES.ARCHIVED ||
    normalized === LIFECYCLE_STATUSES.PERSISTED
  )
}

module.exports = {
  LIFECYCLE_STATUSES,
  isKnownLifecycleStatus,
  isTerminalLifecycleStatus
}
