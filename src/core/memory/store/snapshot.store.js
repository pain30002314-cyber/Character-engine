const memoryConfig = require('../memory.config')
const { readJson, writeJson } = require('../../../services/file.service')

function createDefaultThreadSnapshot() {
  return {
    summary: '',
    recentFacts: [],
    entities: [],
    openLoops: [],
    relationshipSignals: [],
    episodicMemories: [],
    recentDialog: [],
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

function readSnapshotDb() {
  return readJson(memoryConfig.files.snapshot, {
    threads: {}
  })
}

function writeSnapshotDb(db) {
  writeJson(memoryConfig.files.snapshot, db)
}

function getThreadSnapshot(threadId) {
  const db = readSnapshotDb()

  if (!db.threads[threadId]) {
    db.threads[threadId] = createDefaultThreadSnapshot()
    writeSnapshotDb(db)
  }

  return db.threads[threadId]
}

function setThreadSnapshot(threadId, snapshot) {
  const db = readSnapshotDb()

  db.threads[threadId] = {
    ...createDefaultThreadSnapshot(),
    ...snapshot,
    updatedAt: new Date().toISOString()
  }

  writeSnapshotDb(db)
  return db.threads[threadId]
}

module.exports = {
  createDefaultThreadSnapshot,
  getThreadSnapshot,
  setThreadSnapshot
}