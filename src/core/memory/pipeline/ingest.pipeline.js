const { getThreadEvents } = require('../store/events.store')
const { runExtractPipeline } = require('./extract.pipeline')
const { runInterpretPipeline } = require('./interpret.pipeline')
const { runUpdatePipeline } = require('./update.pipeline')
const { runSnapshotPipeline } = require('./snapshot.pipeline')
const {
  looksLikeContaminatedAssistantEvent
} = require('../hygiene/admission.service')

async function runIngestPipeline({ threadId, eventId }) {
  const events = getThreadEvents(threadId)
  const event = events.find((item) => item.id === eventId) || events[events.length - 1] || null

  if (!event) {
    return runSnapshotPipeline({ threadId })
  }

  if (event.meta?.invalidForMemory) {
    return runSnapshotPipeline({ threadId })
  }

  if (looksLikeContaminatedAssistantEvent(event)) {
    return runSnapshotPipeline({ threadId })
  }

  const extracted = await runExtractPipeline({
    threadId,
    event
  })

  const interpreted = await runInterpretPipeline({
    threadId,
    event,
    extracted
  })

  await runUpdatePipeline({
    threadId,
    interpreted
  })

  return runSnapshotPipeline({ threadId })
}

module.exports = {
  runIngestPipeline
}