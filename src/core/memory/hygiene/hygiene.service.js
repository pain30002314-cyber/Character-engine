const {
  MEMORY_ITEM_STATUS,
  MEMORY_PRIORITY
} = require('../../../shared/memory.types')

function priorityRank(priority) {
  switch (priority) {
    case MEMORY_PRIORITY.SACRED:
      return 4
    case MEMORY_PRIORITY.HIGH:
      return 3
    case MEMORY_PRIORITY.MEDIUM:
      return 2
    default:
      return 1
  }
}

function safeIso(value) {
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function pickMoreUsefulText(prevValue, nextValue) {
  const prev = String(prevValue || '').trim()
  const next = String(nextValue || '').trim()

  if (!prev) return next
  if (!next) return prev

  return next.length >= prev.length ? next : prev
}

function mergePayload(prevPayload = {}, nextPayload = {}) {
  const merged = {
    ...prevPayload,
    ...nextPayload
  }

  if ('text' in prevPayload || 'text' in nextPayload) {
    merged.text = pickMoreUsefulText(prevPayload.text, nextPayload.text)
  }

  if ('summary' in prevPayload || 'summary' in nextPayload) {
    merged.summary = pickMoreUsefulText(prevPayload.summary, nextPayload.summary)
  }

  if ('normalizedText' in prevPayload || 'normalizedText' in nextPayload) {
    merged.normalizedText = pickMoreUsefulText(
      prevPayload.normalizedText,
      nextPayload.normalizedText
    )
  }

  if ('name' in prevPayload || 'name' in nextPayload) {
    merged.name = pickMoreUsefulText(prevPayload.name, nextPayload.name)
  }

  return merged
}

function getSemanticKey(item) {
  return (
    item?.payload?.semanticKey ||
    item?.payload?.normalizedText ||
    null
  )
}

function buildSemanticIdentity(item) {
  if (!item || !item.schema) {
    return null
  }

  const semanticKey = getSemanticKey(item)
  if (!semanticKey) {
    return null
  }

  switch (item.schema) {
    case 'belief':
    case 'open_loop':
    case 'relationship_signal':
    case 'episode_stub':
      return [
        item.schema,
        item.subjectRef || '',
        item.objectRef || '',
        semanticKey
      ].join('::')

    default:
      return null
  }
}

function mergeItems(prev, item) {
  return {
    ...prev,
    ...item,
    payload: mergePayload(prev.payload || {}, item.payload || {}),
    confidence: Math.max(prev.confidence || 0, item.confidence || 0),
    importance: Math.max(prev.importance || 0, item.importance || 0),
    stability: Math.max(prev.stability || 0, item.stability || 0),
    priority:
      priorityRank(item.priority) >= priorityRank(prev.priority)
        ? item.priority || prev.priority
        : prev.priority,
    confirmations: (prev.confirmations || 1) + 1,
    firstSeenAt: prev.firstSeenAt || item.firstSeenAt,
    lastSeenAt:
      safeIso(item.lastSeenAt || item.firstSeenAt) >= safeIso(prev.lastSeenAt)
        ? item.lastSeenAt || item.firstSeenAt || prev.lastSeenAt
        : prev.lastSeenAt,
    lastUsedAt: item.lastUsedAt || prev.lastUsedAt || null,
    status:
      prev.status === MEMORY_ITEM_STATUS.CONTRADICTED
        ? MEMORY_ITEM_STATUS.CONTRADICTED
        : item.status || prev.status
  }
}

function mergeCanonicalItems(existing, incoming, limit = 200) {
  const byId = new Map()
  const semanticToId = new Map()

  for (const item of existing || []) {
    byId.set(item.id, item)

    const semanticIdentity = buildSemanticIdentity(item)
    if (semanticIdentity) {
      semanticToId.set(semanticIdentity, item.id)
    }
  }

  for (const item of incoming || []) {
    const directPrev = byId.get(item.id)

    if (directPrev) {
      const merged = mergeItems(directPrev, item)
      byId.set(item.id, merged)

      const semanticIdentity = buildSemanticIdentity(merged)
      if (semanticIdentity) {
        semanticToId.set(semanticIdentity, merged.id)
      }

      continue
    }

    const semanticIdentity = buildSemanticIdentity(item)
    const semanticMatchId = semanticIdentity
      ? semanticToId.get(semanticIdentity)
      : null

    if (semanticMatchId && byId.has(semanticMatchId)) {
      const prev = byId.get(semanticMatchId)
      const merged = mergeItems(prev, item)

      byId.set(semanticMatchId, merged)

      if (semanticIdentity) {
        semanticToId.set(semanticIdentity, semanticMatchId)
      }

      continue
    }

    byId.set(item.id, item)

    if (semanticIdentity) {
      semanticToId.set(semanticIdentity, item.id)
    }
  }

  return [...byId.values()]
    .sort((a, b) => {
      const byPriority = priorityRank(b.priority) - priorityRank(a.priority)
      if (byPriority !== 0) return byPriority

      const byImportance = (b.importance || 0) - (a.importance || 0)
      if (byImportance !== 0) return byImportance

      return safeIso(b.lastSeenAt) - safeIso(a.lastSeenAt)
    })
    .slice(0, limit)
}

function trimRawExtractions(existing, incoming, limit = 30) {
  return [...(existing || []), ...(incoming || [])].slice(-limit)
}

module.exports = {
  mergeCanonicalItems,
  trimRawExtractions
}