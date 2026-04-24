const logger = require('../../../services/logger.service')
const memoryConfig = require('../memory.config')
const { processMemoryJob } = require('./memory.worker')
const extractionSettings = require('../raw/extraction.settings')
const { writeMemoryLiveTrace } = require('../debug/memory-debug.service')

const jobs = []
let isProcessing = false
let scheduled = false
let nextJobId = 1

function enqueueMemoryJob(job) {
  if (jobs.length >= memoryConfig.queue.maxJobs) {
    jobs.shift()

    logger.warn('Memory queue overflow, oldest job dropped', {
      maxJobs: memoryConfig.queue.maxJobs
    })
  }

  const queuedJob = {
    id: nextJobId++,
    createdAt: new Date().toISOString(),
    ...job
  }

  jobs.push(queuedJob)

  writeMemoryLiveTrace({
    marker: 'memory_job_enqueued',
    eventId: queuedJob?.payload?.eventId || queuedJob?.payload?.sourceEventId || null,
    threadId: queuedJob?.payload?.threadId || null,
    messageId: queuedJob?.id || null,
    memoryExtractionMode: extractionSettings.mode,
    wideLlmExtractorEnabled: extractionSettings.wideLlmExtractorEnabled,
    disablePersistenceWrite: extractionSettings.disablePersistenceWrite,
    note: queuedJob.type || 'unknown_job'
  })

  scheduleQueueRun()

  return queuedJob.id
}

function scheduleQueueRun() {
  if (scheduled || isProcessing) {
    return
  }

  scheduled = true

  setImmediate(async () => {
    scheduled = false
    await runQueue()
  })
}

async function runQueue() {
  if (isProcessing) {
    return
  }

  isProcessing = true

  try {
    while (jobs.length > 0) {
      const job = jobs.shift()

      try {
        await processMemoryJob(job)
      } catch (error) {
        logger.error('Memory job failed', {
          jobId: job.id,
          type: job.type,
          message: error.message
        })
      }
    }
  } finally {
    isProcessing = false

    if (jobs.length > 0) {
      scheduleQueueRun()
    }
  }
}

function getMemoryQueueStats() {
  return {
    pendingJobs: jobs.length,
    isProcessing
  }
}

module.exports = {
  enqueueMemoryJob,
  getMemoryQueueStats
}
