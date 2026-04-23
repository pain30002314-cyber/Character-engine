'use strict'

const { getThreadMemory, upsertThreadMemory } = require('../store/memory.store')
const {
  applyMemoryStatusFilter,
  buildMemoryStatusSummary
} = require('../filters/status')
const { runSnapshotPipeline } = require('./snapshot.pipeline')
const { writeMemoryDebug } = require('../debug/memory-debug.service')

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

  writeMemoryDebug({
    layer: 'status-filter',
    timestamp: new Date().toISOString(),
    threadId,
    input: {
      items: existingItems
    },
    output: {
      items: nextItems,
      statusSummary
    },
    meta: {
      inputCount: existingItems.length,
      outputCount: nextItems.length
    },
    errors: []
  })

  return runSnapshotPipeline({ threadId })
}

module.exports = {
  runStatusPipeline
}
