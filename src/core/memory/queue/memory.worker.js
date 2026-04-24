const logger = require('../../../services/logger.service')
const { runIngestPipeline } = require('../pipeline/ingest.pipeline')
const { runSnapshotPipeline } = require('../pipeline/snapshot.pipeline')
const { runStatusPipeline } = require('../pipeline/status.pipeline')
const extractionSettings = require('../raw/extraction.settings')
const { writeMemoryLiveTrace } = require('../debug/memory-debug.service')

async function processMemoryJob(job) {
  if (!job || !job.type) {
    return
  }

  writeMemoryLiveTrace({
    marker: 'memory_job_started',
    eventId: job?.payload?.eventId || job?.payload?.sourceEventId || null,
    threadId: job?.payload?.threadId || null,
    messageId: job?.id || null,
    memoryExtractionMode: extractionSettings.mode,
    wideLlmExtractorEnabled: extractionSettings.wideLlmExtractorEnabled,
    disablePersistenceWrite: extractionSettings.disablePersistenceWrite,
    note: job.type
  })

  logger.debug('Memory worker picked job', {
    type: job.type,
    threadId: job.payload?.threadId
  })

  switch (job.type) {
    case 'ingest_user_message':
    case 'ingest_assistant_message':
      return runIngestPipeline(job.payload)

    case 'apply_status_filter':
      return runStatusPipeline(job.payload)

    case 'rebuild_snapshot':
      return runSnapshotPipeline(job.payload)

    default:
      logger.warn('Unknown memory job type', { type: job.type })
  }
}

module.exports = { processMemoryJob }
