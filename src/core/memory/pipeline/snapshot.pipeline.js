const memoryConfig = require('../memory.config')
const { getThreadEvents } = require('../store/events.store')
const { getThreadMemory } = require('../store/memory.store')
const { setThreadSnapshot } = require('../store/snapshot.store')

function formatIsoShort(iso) {
  if (!iso) return null

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function pickFacts(memory) {
  return (memory.facts || [])
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, memoryConfig.limits.snapshotFacts)
    .map((item) => item.text)
}

function pickEntities(memory) {
  return (memory.entities || [])
    .sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0))
    .slice(0, memoryConfig.limits.snapshotEntities)
    .map((item) => item.name)
}

function pickOpenLoops(memory) {
  return (memory.openLoops || [])
    .filter((item) => item.status !== 'resolved')
    .sort((a, b) => new Date(b.lastMentionAt || 0) - new Date(a.lastMentionAt || 0))
    .slice(0, memoryConfig.limits.snapshotOpenLoops)
    .map((item) => item.text)
}

function pickRelationshipSignals(memory) {
  return (memory.relationshipSignals || [])
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, memoryConfig.limits.snapshotRelationshipSignals)
    .map((item) => item.text)
}

function pickEpisodes(memory) {
  return (memory.episodicMemories || [])
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, memoryConfig.limits.snapshotEpisodes)
    .map((item) => item.summary)
}

function buildSummary(memory) {
  const parts = []

  const topFacts = pickFacts(memory).slice(0, 3)
  const topEntities = pickEntities(memory).slice(0, 3)
  const topLoops = pickOpenLoops(memory).slice(0, 2)

  if (topFacts.length) {
    parts.push(`Ключевые факты: ${topFacts.join(' | ')}`)
  }

  if (topEntities.length) {
    parts.push(`Главные сущности: ${topEntities.join(' | ')}`)
  }

  if (topLoops.length) {
    parts.push(`Открытые темы: ${topLoops.join(' | ')}`)
  }

  return parts.join('\n')
}

async function runSnapshotPipeline({ threadId }) {
  const events = getThreadEvents(threadId)
  const memory = getThreadMemory(threadId)

  const recentDialog = events
    .slice(-memoryConfig.limits.recentDialogPerThread)
    .map((event) => ({
      role: event.role,
      text: event.text,
      timestamp: event.timestamp
    }))

  const snapshot = {
    summary: buildSummary(memory),
    recentFacts: pickFacts(memory),
    entities: pickEntities(memory),
    openLoops: pickOpenLoops(memory),
    relationshipSignals: pickRelationshipSignals(memory),
    episodicMemories: pickEpisodes(memory),
    recentDialog,
    temporal: {
      firstSeenAt: formatIsoShort(memory.temporal?.firstSeenAt),
      lastSeenAt: formatIsoShort(memory.temporal?.lastSeenAt),
      lastUserMessageAt: formatIsoShort(memory.temporal?.lastUserMessageAt),
      lastAssistantMessageAt: formatIsoShort(memory.temporal?.lastAssistantMessageAt),
      messageCount: memory.temporal?.messageCount || 0
    }
  }

  return setThreadSnapshot(threadId, snapshot)
}

module.exports = {
  runSnapshotPipeline
}