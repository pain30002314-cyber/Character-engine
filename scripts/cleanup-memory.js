const path = require('path')
const { readJson, writeJson } = require('../src/services/file.service')
const {
  looksLikeMetaInstructionBlock,
  isClaimAdmissible
} = require('../src/core/memory/hygiene/admission.service')

const memoryPath = path.join(__dirname, '../src/core/memory/data/memory.json')
const eventsPath = path.join(__dirname, '../src/core/memory/data/events.json')
const snapshotPath = path.join(__dirname, '../src/core/memory/data/snapshot.json')

function cleanupEventsDb(db) {
  for (const threadId of Object.keys(db.threads || {})) {
    db.threads[threadId] = (db.threads[threadId] || []).map((event) => {
      const invalid =
        event?.meta?.invalidForMemory ||
        (event?.role === 'assistant' && looksLikeMetaInstructionBlock(event.text))

      return {
        ...event,
        meta: {
          ...(event.meta || {}),
          invalidForMemory: Boolean(invalid)
        }
      }
    })
  }

  return db
}

function cleanupMemoryDb(db) {
  for (const threadId of Object.keys(db.threads || {})) {
    const thread = db.threads[threadId]
    const rawExtractions = Array.isArray(thread.rawExtractions) ? thread.rawExtractions : []
    const canonicalItems = Array.isArray(thread.canonicalMemory?.items)
      ? thread.canonicalMemory.items
      : []

    thread.rawExtractions = rawExtractions.map((packet) => ({
      ...packet,
      claims: (packet.claims || []).filter(isClaimAdmissible)
    }))

    thread.canonicalMemory = {
      ...(thread.canonicalMemory || {}),
      items: canonicalItems.filter((item) => {
        const text =
          item?.payload?.text ||
          item?.payload?.summary ||
          item?.payload?.name ||
          item?.key ||
          ''

        if (!text) return false
        if (looksLikeMetaInstructionBlock(text)) return false

        const claimTypeMap = {
          belief: 'fact',
          entity: 'entity',
          relationship_signal: 'relationship',
          open_loop: 'open_loop',
          episode_stub: 'episode'
        }

        const pseudoClaimType = claimTypeMap[item.schema]
        if (!pseudoClaimType) return true

        return isClaimAdmissible({
          claimType: pseudoClaimType,
          text
        })
      })
    }
  }

  return db
}

function wipeSnapshotDb(db) {
  for (const threadId of Object.keys(db.threads || {})) {
    db.threads[threadId] = {
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
      updatedAt: new Date().toISOString()
    }
  }

  return db
}

function main() {
  const eventsDb = readJson(eventsPath, { threads: {} })
  const memoryDb = readJson(memoryPath, { threads: {} })
  const snapshotDb = readJson(snapshotPath, { threads: {} })

  writeJson(eventsPath, cleanupEventsDb(eventsDb))
  writeJson(memoryPath, cleanupMemoryDb(memoryDb))
  writeJson(snapshotPath, wipeSnapshotDb(snapshotDb))

  console.log('Memory cleanup finished.')
  console.log('Next step: run app and trigger rebuild via fresh dialogue flow.')
}

main()