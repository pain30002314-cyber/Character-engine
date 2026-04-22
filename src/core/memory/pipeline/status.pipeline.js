'use strict'

const { getThreadMemory, upsertThreadMemory } = require('../store/memory.store')
const { applyMemoryStatusFilter, buildMemoryStatusSummary } = require('../filters/status')
const { runSnapshotPipeline } = require('./snapshot.pipeline')

async function runStatusPipeline({ threadId }) {
  const existing = getThreadMemory(threadId)

  const existingItems = Array.isArray(existing?.canonicalMemory?.items)
    ? existing.canonicalMemory.items
    : []

  const nextItems = applyMemoryStatusFilter(existingItems)
  const statusSummary = buildMemoryStatusSummary(nextItems)

  upsertThreadMemory(threadId, {
    canonicalMemory: {
      ...(existing.canonicalMemory || {}),
      items: nextItems
    },
    statusSummary
  })

  return runSnapshotPipeline({ threadId })
}

module.exports = {
  runStatusPipeline
}
