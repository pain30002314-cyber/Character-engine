const memoryConfig = require('../memory.config')
const { readJson, writeJson } = require('../../../services/file.service')

function readEventsDb() {
  return readJson(memoryConfig.files.events, {
    threads: {}
  })
}

function writeEventsDb(db) {
  writeJson(memoryConfig.files.events, db)
}

function appendEvent(threadId, event) {
  const db = readEventsDb()

  if (!db.threads[threadId]) {
    db.threads[threadId] = []
  }

  db.threads[threadId].push(event)

  const limit = memoryConfig.limits.maxEventsPerThread
  if (db.threads[threadId].length > limit) {
    db.threads[threadId] = db.threads[threadId].slice(-limit)
  }

  writeEventsDb(db)
  return event
}

function getThreadEvents(threadId, options = {}) {
  const db = readEventsDb()
  const events = db.threads[threadId] || []

  if (options.includeInvalidForMemory) {
    return events
  }

  return events.filter((event) => !event?.meta?.invalidForMemory)
}

module.exports = {
  appendEvent,
  getThreadEvents
}