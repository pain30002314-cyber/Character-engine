const crypto = require('crypto')

const memoryConfig = require('./memory.config')
const { appendEvent, getThreadEvents } = require('./store/events.store')
const { getThreadSnapshot, setThreadSnapshot } = require('./store/snapshot.store')
const { enqueueMemoryJob } = require('./queue/memory.queue')
const {
  looksLikeContaminatedAssistantEvent
} = require('./hygiene/admission.service')
const { extractRegexAtomsV1 } = require('./extractors/regex')
const {
  getNowTimestamp,
  enrichMetaWithTimeContext
} = require('../../services/time-context.service')
const logger = require('../../services/logger.service')

function createEventId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getThreadId({ platform, chatId }) {
  return `${platform}:${chatId}`
}

function createEvent({
  threadId,
  role,
  text,
  platform,
  channel,
  world,
  meta = {}
}) {
  return {
    id: createEventId(),
    threadId,
    role,
    text: String(text || ''),
    platform: platform || 'unknown',
    channel: channel || 'text',
    world: world || 'Earth',
    timestamp: getNowTimestamp(),
    meta: enrichMetaWithTimeContext(meta)
  }
}

function refreshRecentDialogSnapshot(threadId) {
  const existingSnapshot = getThreadSnapshot(threadId)
  const events = getThreadEvents(threadId)

  const recentDialog = events
    .slice(-memoryConfig.limits.recentDialogPerThread)
    .map((event) => ({
      role: event.role,
      text: event.text,
      timestamp: event.timestamp
    }))

  return setThreadSnapshot(threadId, {
    ...existingSnapshot,
    recentDialog
  })
}

async function runRegexDebugPass(event) {
  if (!event || event.role !== 'user') {
    return
  }

  try {
    await extractRegexAtomsV1({ event })
  } catch (error) {
    logger.warn('Regex debug pass failed', {
      eventId: event?.id || null,
      threadId: event?.threadId || null,
      message: error.message
    })
  }
}

async function recordUserMessage({
  threadId,
  text,
  platform,
  channel,
  world,
  chatId,
  userId,
  username
}) {
  const event = createEvent({
    threadId,
    role: 'user',
    text,
    platform,
    channel,
    world,
    meta: {
      chatId,
      userId,
      username
    }
  })

  appendEvent(threadId, event)
  refreshRecentDialogSnapshot(threadId)

  await runRegexDebugPass(event)

  enqueueMemoryJob({
    type: 'ingest_user_message',
    payload: {
      threadId,
      eventId: event.id
    }
  })

  return event
}

async function recordAssistantMessage({
  threadId,
  text,
  platform,
  channel,
  world,
  chatId
}) {
  const event = createEvent({
    threadId,
    role: 'assistant',
    text,
    platform,
    channel,
    world,
    meta: {
      chatId
    }
  })

  const contaminated = looksLikeContaminatedAssistantEvent(event)

  appendEvent(threadId, {
    ...event,
    meta: {
      ...event.meta,
      invalidForMemory: contaminated
    }
  })

  refreshRecentDialogSnapshot(threadId)

  if (!contaminated) {
    enqueueMemoryJob({
      type: 'ingest_assistant_message',
      payload: {
        threadId,
        eventId: event.id
      }
    })
  }

  return event
}

async function getMemorySnapshot(threadId) {
  return getThreadSnapshot(threadId)
}

async function rebuildSnapshot(threadId) {
  enqueueMemoryJob({
    type: 'rebuild_snapshot',
    payload: {
      threadId
    }
  })

  return getThreadSnapshot(threadId)
}

module.exports = {
  getThreadId,
  recordUserMessage,
  recordAssistantMessage,
  getMemorySnapshot,
  rebuildSnapshot,
  refreshRecentDialogSnapshot
}