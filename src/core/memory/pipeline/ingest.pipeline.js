'use strict'

const { getThreadEvents } = require('../store/events.store')
const extractionSettings = require('../raw/extraction.settings')
const { runExtractPipeline } = require('./extract.pipeline')
const { runExtractFilterObservePipeline } = require('./extract-filter-observe.pipeline')
const { runInterpretPipeline } = require('./interpret.pipeline')
const { runUpdatePipeline } = require('./update.pipeline')
const { runSnapshotPipeline } = require('./snapshot.pipeline')
const { looksLikeContaminatedAssistantEvent } = require('../hygiene/admission.service')
const logger = require('../../../services/logger.service')
const { writeMemoryLiveTrace } = require('../debug/memory-debug.service')

async function runIngestPipeline({ threadId, eventId }) {
  const events = getThreadEvents(threadId)
  const event = events.find((item) => item.id === eventId) || events[events.length - 1] || null

  writeMemoryLiveTrace({
    marker: 'ingest_pipeline_started',
    eventId: event?.id || eventId || null,
    threadId,
    messageId: event?.id || eventId || null,
    memoryExtractionMode: extractionSettings.mode,
    wideLlmExtractorEnabled: extractionSettings.wideLlmExtractorEnabled,
    disablePersistenceWrite: extractionSettings.disablePersistenceWrite,
    note: event ? 'event_loaded' : 'event_missing'
  })

  if (!event) {
    return runSnapshotPipeline({ threadId })
  }

  if (event.meta?.invalidForMemory) {
    return runSnapshotPipeline({ threadId })
  }

  if (looksLikeContaminatedAssistantEvent(event)) {
    return runSnapshotPipeline({ threadId })
  }

  let observeResult = null

  if (extractionSettings.wideLlmExtractorEnabled) {
    observeResult = await runExtractFilterObservePipeline({
      threadId,
      event,
      history: events
    })
  }

  if (extractionSettings.disablePersistenceWrite) {
    logger.info('Memory persistence write skipped by config', {
      threadId,
      eventId: event?.id || null,
      wideLlmExtractorEnabled: extractionSettings.wideLlmExtractorEnabled,
      extractionMode: extractionSettings.mode,
      observeStatus: observeResult?.status || null
    })

    return {
      threadId,
      eventId: event?.id || null,
      status: observeResult?.status || 'success',
      persistenceSkipped: true,
      observeResult
    }
  }

  const extracted = await runExtractPipeline({ threadId, event })
  const interpreted = await runInterpretPipeline({ threadId, event, extracted })
  await runUpdatePipeline({ threadId, interpreted })

  const { enqueueMemoryJob } = require('../queue/memory.queue')
  enqueueMemoryJob({
    type: 'apply_status_filter',
    payload: {
      threadId,
      sourceEventId: event.id,
      triggeredBy: 'ingest_pipeline'
    }
  })

  return {
    threadId,
    eventId: event?.id || null,
    status: 'success',
    persistenceSkipped: false,
    observeResult
  }
}

module.exports = { runIngestPipeline }
