'use strict'

const { MEMORY_ITEM_STATUS, MEMORY_PRIORITY } = require('../../../../shared/memory.types')

const MEMORY_STATUS = {
  TRACE: 'trace',
  CANDIDATE: 'candidate',
  EMERGING_PATTERN: 'emerging_pattern',
  STABLE: 'stable',
  CORE: 'core',

  WEAK: 'weak',
  STALE: 'stale',
  ARCHIVED: 'archived',
  CONTRADICTED: 'contradicted',

  EPISODIC_TRACE: 'episodic_trace'
}

const ALL_MEMORY_STATUSES = new Set(Object.values(MEMORY_STATUS))

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function clamp01(value, fallback = 0.5) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  if (num < 0) return 0
  if (num > 1) return 1
  return num
}

function normalizeSupportCount(value, fallback = 1) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.floor(num)
}

function normalizeMemoryStatus(value, fallback = MEMORY_STATUS.TRACE) {
  const normalized = String(value || '').trim()
  return ALL_MEMORY_STATUSES.has(normalized) ? normalized : fallback
}

function mapCanonicalStatusToMemoryStatus(item) {
  switch (item?.status) {
    case MEMORY_ITEM_STATUS.STALE:
      return MEMORY_STATUS.STALE
    case MEMORY_ITEM_STATUS.ARCHIVED:
      return MEMORY_STATUS.ARCHIVED
    case MEMORY_ITEM_STATUS.CONTRADICTED:
      return MEMORY_STATUS.CONTRADICTED
    default:
      return null
  }
}

function isEpisode(item) {
  return item?.schema === 'episode_stub'
}

function isHighPriority(item) {
  return item?.priority === MEMORY_PRIORITY.HIGH || item?.priority === MEMORY_PRIORITY.SACRED
}

function pickInitialMemoryStatus(item) {
  const mappedCanonical = mapCanonicalStatusToMemoryStatus(item)
  if (mappedCanonical) return mappedCanonical

  if (isEpisode(item)) {
    return MEMORY_STATUS.EPISODIC_TRACE
  }

  const confirmations = Number(item?.confirmations || 1)
  const confidence = Number(item?.confidence || 0)
  const importance = Number(item?.importance || 0)
  const stability = Number(item?.stability || 0)

  if (confirmations <= 1 && confidence < 0.5) {
    return MEMORY_STATUS.TRACE
  }

  if (confirmations <= 1) {
    return MEMORY_STATUS.CANDIDATE
  }

  if (confirmations === 2) {
    return MEMORY_STATUS.EMERGING_PATTERN
  }

  if (
    isHighPriority(item) &&
    confirmations >= 4 &&
    confidence >= 0.75 &&
    importance >= 70
  ) {
    return MEMORY_STATUS.CORE
  }

  if (
    confirmations >= 3 ||
    stability >= 0.75 ||
    (confidence >= 0.8 && importance >= 65)
  ) {
    return MEMORY_STATUS.STABLE
  }

  return MEMORY_STATUS.EMERGING_PATTERN
}

function shouldDowngradeToWeak(item) {
  const confirmations = Number(item?.confirmations || 1)
  const confidence = Number(item?.confidence || 0)
  const importance = Number(item?.importance || 0)

  return confirmations <= 1 && confidence < 0.45 && importance < 45
}

function buildLifecycle(item, now) {
  const existing = safeObject(item?.lifecycle)
  const existingMemoryStatus = normalizeMemoryStatus(
    existing.memoryStatus,
    pickInitialMemoryStatus(item)
  )

  let resolvedMemoryStatus = existingMemoryStatus

  const mappedCanonical = mapCanonicalStatusToMemoryStatus(item)
  if (mappedCanonical) {
    resolvedMemoryStatus = mappedCanonical
  } else if (
    existingMemoryStatus === MEMORY_STATUS.CANDIDATE &&
    shouldDowngradeToWeak(item)
  ) {
    resolvedMemoryStatus = MEMORY_STATUS.WEAK
  }

  return {
    version: 'memory_status_v1',
    stage: 'ingestion_support',
    memoryStatus: resolvedMemoryStatus,
    supportCount: normalizeSupportCount(existing.supportCount, item?.confirmations || 1),
    confidence: clamp01(existing.confidence ?? item?.confidence, 0.5),
    importance: clamp01(
      existing.importance ?? (Number(item?.importance || 0) / 100),
      0.5
    ),
    linkedEntityId:
      existing.linkedEntityId ||
      item?.subjectRef ||
      item?.objectRef ||
      null,
    firstClassifiedAt: existing.firstClassifiedAt || now,
    lastClassifiedAt: now,
    lastUsedAt: existing.lastUsedAt || item?.lastUsedAt || null,
    source: existing.source || 'status_filter_v1'
  }
}

function applyMemoryStatusToItem(item, now = new Date().toISOString()) {
  if (!item || typeof item !== 'object') {
    return item
  }

  const lifecycle = buildLifecycle(item, now)

  return {
    ...item,
    lifecycle
  }
}

function applyMemoryStatusFilter(items, options = {}) {
  const now = options.now || new Date().toISOString()
  return safeArray(items).map((item) => applyMemoryStatusToItem(item, now))
}

function buildMemoryStatusSummary(items) {
  const summary = {
    total: 0,
    trace: 0,
    candidate: 0,
    episodic_trace: 0,
    emerging_pattern: 0,
    stable: 0,
    core: 0,
    weak: 0,
    stale: 0,
    archived: 0,
    contradicted: 0
  }

  for (const item of safeArray(items)) {
    summary.total += 1
    const status = item?.lifecycle?.memoryStatus
    if (status && Object.prototype.hasOwnProperty.call(summary, status)) {
      summary[status] += 1
    }
  }

  return summary
}

module.exports = {
  MEMORY_STATUS,
  applyMemoryStatusFilter,
  buildMemoryStatusSummary
}