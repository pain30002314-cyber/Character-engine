'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

test('memory worker routes apply_status_filter job into status pipeline', async () => {
  const workerPath = require.resolve('../src/core/memory/queue/memory.worker')
  const statusPipelinePath = require.resolve('../src/core/memory/pipeline/status.pipeline')
  const ingestPipelinePath = require.resolve('../src/core/memory/pipeline/ingest.pipeline')
  const snapshotPipelinePath = require.resolve('../src/core/memory/pipeline/snapshot.pipeline')

  const originalStatusPipeline = require(statusPipelinePath)
  const originalIngestPipeline = require(ingestPipelinePath)
  const originalSnapshotPipeline = require(snapshotPipelinePath)

  let calledWith = null

  require.cache[statusPipelinePath].exports = {
    ...originalStatusPipeline,
    runStatusPipeline: async (payload) => {
      calledWith = payload
      return { ok: true }
    }
  }

  require.cache[ingestPipelinePath].exports = {
    ...originalIngestPipeline,
    runIngestPipeline: async () => {
      throw new Error('runIngestPipeline should not be called in this test')
    }
  }

  require.cache[snapshotPipelinePath].exports = {
    ...originalSnapshotPipeline,
    runSnapshotPipeline: async () => {
      throw new Error('runSnapshotPipeline should not be called in this test')
    }
  }

  delete require.cache[workerPath]
  const { processMemoryJob } = require(workerPath)

  try {
    const payload = { threadId: 'telegram:1', sourceEventId: 'evt_1' }
    await processMemoryJob({
      type: 'apply_status_filter',
      payload
    })

    assert.deepEqual(calledWith, payload)
  } finally {
    require.cache[statusPipelinePath].exports = originalStatusPipeline
    require.cache[ingestPipelinePath].exports = originalIngestPipeline
    require.cache[snapshotPipelinePath].exports = originalSnapshotPipeline
    delete require.cache[workerPath]
  }
})