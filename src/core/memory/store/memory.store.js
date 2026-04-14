const memoryConfig = require('../memory.config')
const { readJson, writeJson } = require('../../../services/file.service')
const { createDefaultIdentityProfile } = require('../identity/identity.store')

function createDefaultThreadMemory(threadId = '') {
  return {
    version: 2,
    profile: {
      threadId,
      createdAt: new Date().toISOString()
    },
    identity: createDefaultIdentityProfile(threadId),
    rawExtractions: [],
    canonicalMemory: {
      items: []
    },

    // compatibility bridge for current reply/snapshot layer
    facts: [],
    entities: [],
    openLoops: [],
    relationshipSignals: [],
    episodicMemories: [],

    temporal: {
      firstSeenAt: null,
      lastSeenAt: null,
      lastUserMessageAt: null,
      lastAssistantMessageAt: null,
      messageCount: 0
    },
    updatedAt: null
  }
}

function readMemoryDb() {
  return readJson(memoryConfig.files.memory, {
    threads: {}
  })
}

function writeMemoryDb(db) {
  writeJson(memoryConfig.files.memory, db)
}

function getThreadMemory(threadId) {
  const db = readMemoryDb()

  if (!db.threads[threadId]) {
    db.threads[threadId] = createDefaultThreadMemory(threadId)
    writeMemoryDb(db)
  }

  return db.threads[threadId]
}

function setThreadMemory(threadId, value) {
  const db = readMemoryDb()

  db.threads[threadId] = {
    ...createDefaultThreadMemory(threadId),
    ...value,
    updatedAt: new Date().toISOString()
  }

  writeMemoryDb(db)
  return db.threads[threadId]
}

function upsertThreadMemory(threadId, patch) {
  const db = readMemoryDb()

  const existing = db.threads[threadId] || createDefaultThreadMemory(threadId)

  db.threads[threadId] = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  }

  writeMemoryDb(db)
  return db.threads[threadId]
}

module.exports = {
  createDefaultThreadMemory,
  getThreadMemory,
  setThreadMemory,
  upsertThreadMemory
}