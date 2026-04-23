'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  ensureLifecycleCandidate,
  appendRoutingHistory,
  updateLifecycleStatus
} = require('../../../../src/core/memory/extractors/llm/lifecycle/lifecycle-history')

test('lifecycle history appends explicit routing entries and status updates', () => {
  const staged = updateLifecycleStatus(
    appendRoutingHistory(ensureLifecycleCandidate({ candidateId: 'c1' }), {
      stage: 'merge',
      action: 'merged'
    }),
    'staged',
    {
      stage: 'stage',
      action: 'staged',
      target: 'stage_only'
    }
  )

  assert.equal(staged.lifecycleStatus, 'staged')
  assert.equal(staged.routingHistory.length, 2)
})
