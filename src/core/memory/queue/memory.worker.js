const logger = require('../../../services/logger.service')
const { runIngestPipeline } = require('../pipeline/ingest.pipeline')
const { runSnapshotPipeline } = require('../pipeline/snapshot.pipeline')

async function processMemoryJob(job) {
  if (!job || !job.type) {
    return
  }

  logger.debug('Memory worker picked job', {
    type: job.type,
    threadId: job.payload?.threadId
  })

  switch (job.type) {
    case 'ingest_user_message':
    case 'ingest_assistant_message':
      return runIngestPipeline(job.payload)

    case 'rebuild_snapshot':
      return runSnapshotPipeline(job.payload)

    default:
      logger.warn('Unknown memory job type', {
        type: job.type
      })
  }
}

module.exports = {
  processMemoryJob
}