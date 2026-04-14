const memoryConfig = require('../memory.config')
const { getThreadMemory, upsertThreadMemory } = require('../store/memory.store')
const { mergeCanonicalItems, trimRawExtractions } = require('../hygiene/hygiene.service')
const { CANONICAL_SCHEMA, MEMORY_ITEM_STATUS } = require('../../../shared/memory.types')

function projectFacts(items) {
  return items
    .filter((item) => item.schema === CANONICAL_SCHEMA.BELIEF)
    .filter((item) => item.status === MEMORY_ITEM_STATUS.ACTIVE)
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, memoryConfig.limits.maxFacts)
    .map((item) => ({
      text: item.payload?.text || item.key,
      category: item.payload?.category || 'general',
      confidence: item.confidence,
      importance: item.importance,
      sourceEventId: item.sourceEventId,
      createdAt: item.firstSeenAt,
      updatedAt: item.lastSeenAt
    }))
}

function projectEntities(items) {
  return items
    .filter((item) => item.schema === CANONICAL_SCHEMA.ENTITY)
    .filter((item) => item.status === MEMORY_ITEM_STATUS.ACTIVE)
    .sort((a, b) => (b.confirmations || 0) - (a.confirmations || 0))
    .slice(0, memoryConfig.limits.maxEntities)
    .map((item) => ({
      name: item.payload?.name || item.key,
      type: item.payload?.type || 'named',
      confidence: item.confidence,
      sourceEventId: item.sourceEventId,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      mentionCount: item.confirmations || 1
    }))
}

function projectOpenLoops(items) {
  return items
    .filter((item) => item.schema === CANONICAL_SCHEMA.OPEN_LOOP)
    .filter((item) => item.status === MEMORY_ITEM_STATUS.ACTIVE)
    .sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0))
    .slice(0, memoryConfig.limits.maxOpenLoops)
    .map((item) => ({
      text: item.payload?.text || item.key,
      type: item.payload?.type || 'topic',
      status: item.payload?.status || 'open',
      confidence: item.confidence,
      sourceEventId: item.sourceEventId,
      createdAt: item.firstSeenAt,
      updatedAt: item.lastSeenAt,
      lastMentionAt: item.lastSeenAt
    }))
}

function projectRelationshipSignals(items) {
  return items
    .filter((item) => item.schema === CANONICAL_SCHEMA.RELATIONSHIP_SIGNAL)
    .filter((item) => item.status === MEMORY_ITEM_STATUS.ACTIVE)
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, memoryConfig.limits.maxRelationshipSignals)
    .map((item) => ({
      text: item.payload?.text || item.key,
      sentiment: item.payload?.sentiment || 'signal',
      importance: item.importance,
      confidence: item.confidence,
      sourceEventId: item.sourceEventId,
      createdAt: item.firstSeenAt
    }))
}

function projectEpisodes(items) {
  return items
    .filter((item) => item.schema === CANONICAL_SCHEMA.EPISODE_STUB)
    .filter((item) => item.status === MEMORY_ITEM_STATUS.ACTIVE)
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, memoryConfig.limits.maxEpisodicMemories)
    .map((item) => ({
      summary: item.payload?.summary || item.key,
      importance: item.importance,
      sourceEventId: item.sourceEventId,
      createdAt: item.firstSeenAt,
      updatedAt: item.lastSeenAt
    }))
}

async function runUpdatePipeline({ threadId, interpreted }) {
  const existing = getThreadMemory(threadId)

  const mergedCanonicalItems = mergeCanonicalItems(
    existing.canonicalMemory?.items || [],
    interpreted.canonical?.items || [],
    memoryConfig.limits.maxCanonicalItems
  )

  return upsertThreadMemory(threadId, {
    version: 2,
    identity: interpreted.identity || existing.identity,
    rawExtractions: trimRawExtractions(
      existing.rawExtractions || [],
      interpreted.rawExtraction ? [interpreted.rawExtraction] : [],
      memoryConfig.limits.maxRawExtractions
    ),
    canonicalMemory: {
      items: mergedCanonicalItems
    },

    // compatibility bridge
    facts: projectFacts(mergedCanonicalItems),
    entities: projectEntities(mergedCanonicalItems),
    openLoops: projectOpenLoops(mergedCanonicalItems),
    relationshipSignals: projectRelationshipSignals(mergedCanonicalItems),
    episodicMemories: projectEpisodes(mergedCanonicalItems),

    temporal: interpreted.temporal || existing.temporal
  })
}

module.exports = {
  runUpdatePipeline
}