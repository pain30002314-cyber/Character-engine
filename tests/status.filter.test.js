'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  MEMORY_STATUS,
  applyMemoryStatusFilter,
  buildMemoryStatusSummary
} = require('../src/core/memory/filters/status')

function buildItem(overrides = {}) {
  return {
    id: overrides.id || 'mem_1',
    schema: overrides.schema || 'belief',
    key: overrides.key || 'user_prefers_gentle_tone',
    status: overrides.status || 'active',
    priority: overrides.priority || 'medium',
    confirmations: overrides.confirmations ?? 1,
    confidence: overrides.confidence ?? 0.5,
    importance: overrides.importance ?? 50,
    stability: overrides.stability ?? 0.3,
    subjectRef: overrides.subjectRef ?? null,
    objectRef: overrides.objectRef ?? null,
    lastUsedAt: overrides.lastUsedAt ?? null,
    lifecycle: overrides.lifecycle,
    ...overrides
  }
}

test('applyMemoryStatusFilter marks weak one-off low-confidence memory as trace', () => {
  const items = [
    buildItem({
      confirmations: 1,
      confidence: 0.32,
      importance: 20,
      stability: 0.1
    })
  ]

  const result = applyMemoryStatusFilter(items, {
    now: '2026-04-22T12:00:00.000Z'
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.TRACE)
  assert.equal(result[0].lifecycle.version, 'memory_status_v1')
  assert.equal(result[0].lifecycle.stage, 'ingestion_support')
  assert.equal(result[0].lifecycle.firstClassifiedAt, '2026-04-22T12:00:00.000Z')
  assert.equal(result[0].lifecycle.lastClassifiedAt, '2026-04-22T12:00:00.000Z')
})

test('applyMemoryStatusFilter marks meaningful first-pass memory as candidate', () => {
  const items = [
    buildItem({
      confirmations: 1,
      confidence: 0.72,
      importance: 58,
      stability: 0.35
    })
  ]

  const result = applyMemoryStatusFilter(items)

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.CANDIDATE)
  assert.equal(result[0].lifecycle.supportCount, 1)
})

test('applyMemoryStatusFilter marks repeated memory as emerging_pattern', () => {
  const items = [
    buildItem({
      confirmations: 2,
      confidence: 0.68,
      importance: 54,
      stability: 0.5
    })
  ]

  const result = applyMemoryStatusFilter(items)

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.EMERGING_PATTERN)
})

test('applyMemoryStatusFilter marks strong repeated memory as stable', () => {
  const items = [
    buildItem({
      confirmations: 3,
      confidence: 0.83,
      importance: 72,
      stability: 0.81
    })
  ]

  const result = applyMemoryStatusFilter(items)

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.STABLE)
})

test('applyMemoryStatusFilter marks very strong high-priority memory as core', () => {
  const items = [
    buildItem({
      priority: 'high',
      confirmations: 4,
      confidence: 0.9,
      importance: 83,
      stability: 0.88
    })
  ]

  const result = applyMemoryStatusFilter(items)

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.CORE)
})

test('applyMemoryStatusFilter marks episode_stub as episodic_trace', () => {
  const items = [
    buildItem({
      schema: 'episode_stub',
      confirmations: 1,
      confidence: 0.44,
      importance: 30
    })
  ]

  const result = applyMemoryStatusFilter(items)

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.EPISODIC_TRACE)
})

test('applyMemoryStatusFilter maps canonical stale status to stale memory status', () => {
  const items = [
    buildItem({
      status: 'stale',
      confirmations: 5,
      confidence: 0.95,
      importance: 90
    })
  ]

  const result = applyMemoryStatusFilter(items)

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.STALE)
})

test('applyMemoryStatusFilter maps canonical archived status to archived memory status', () => {
  const items = [
    buildItem({
      status: 'archived'
    })
  ]

  const result = applyMemoryStatusFilter(items)

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.ARCHIVED)
})

test('applyMemoryStatusFilter maps canonical contradicted status to contradicted memory status', () => {
  const items = [
    buildItem({
      status: 'contradicted'
    })
  ]

  const result = applyMemoryStatusFilter(items)

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.CONTRADICTED)
})

test('applyMemoryStatusFilter downgrades existing candidate to weak when signal stays too weak', () => {
  const items = [
    buildItem({
      confirmations: 1,
      confidence: 0.2,
      importance: 15,
      lifecycle: {
        memoryStatus: 'candidate',
        supportCount: 1,
        firstClassifiedAt: '2026-04-20T12:00:00.000Z'
      }
    })
  ]

  const result = applyMemoryStatusFilter(items, {
    now: '2026-04-22T12:00:00.000Z'
  })

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.WEAK)
  assert.equal(result[0].lifecycle.firstClassifiedAt, '2026-04-20T12:00:00.000Z')
  assert.equal(result[0].lifecycle.lastClassifiedAt, '2026-04-22T12:00:00.000Z')
})

test('applyMemoryStatusFilter preserves existing lifecycle supportCount and linked entity id', () => {
  const items = [
    buildItem({
      subjectRef: 'entity_user',
      lifecycle: {
        memoryStatus: 'stable',
        supportCount: 7,
        linkedEntityId: 'entity_existing',
        firstClassifiedAt: '2026-04-18T12:00:00.000Z'
      }
    })
  ]

  const result = applyMemoryStatusFilter(items, {
    now: '2026-04-22T12:00:00.000Z'
  })

  assert.equal(result[0].lifecycle.memoryStatus, MEMORY_STATUS.STABLE)
  assert.equal(result[0].lifecycle.supportCount, 7)
  assert.equal(result[0].lifecycle.linkedEntityId, 'entity_existing')
  assert.equal(result[0].lifecycle.firstClassifiedAt, '2026-04-18T12:00:00.000Z')
})

test('buildMemoryStatusSummary counts statuses correctly', () => {
  const items = [
    { lifecycle: { memoryStatus: 'trace' } },
    { lifecycle: { memoryStatus: 'candidate' } },
    { lifecycle: { memoryStatus: 'candidate' } },
    { lifecycle: { memoryStatus: 'stable' } },
    { lifecycle: { memoryStatus: 'core' } },
    { lifecycle: { memoryStatus: 'archived' } }
  ]

  const summary = buildMemoryStatusSummary(items)

  assert.deepEqual(summary, {
    total: 6,
    trace: 1,
    candidate: 2,
    episodic_trace: 0,
    emerging_pattern: 0,
    stable: 1,
    core: 1,
    weak: 0,
    stale: 0,
    archived: 1,
    contradicted: 0
  })
})

test('applyMemoryStatusFilter returns empty array for invalid input', () => {
  assert.deepEqual(applyMemoryStatusFilter(null), [])
  assert.deepEqual(applyMemoryStatusFilter(undefined), [])
  assert.deepEqual(applyMemoryStatusFilter({ nope: true }), [])
})