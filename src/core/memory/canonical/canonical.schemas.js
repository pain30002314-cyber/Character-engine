const {
  CANONICAL_SCHEMA,
  MEMORY_ITEM_STATUS,
  MEMORY_PRIORITY
} = require('../../../shared/memory.types')
const {
  normalizeText,
  buildCanonicalKey,
  makeCanonicalItemId
} = require('./canonical.helpers')

function createCanonicalItem({
  schema,
  key,
  subjectRef = null,
  objectRef = null,
  value = null,
  payload = {},
  sourceEventId = null,
  confidence = 0.5,
  importance = 50,
  stability = 0.5,
  confirmations = 1,
  firstSeenAt = null,
  lastSeenAt = null,
  lastUsedAt = null,
  priority = MEMORY_PRIORITY.MEDIUM,
  status = MEMORY_ITEM_STATUS.ACTIVE
}) {
  const normalizedKey = normalizeText(key)

  return {
    id: makeCanonicalItemId(schema, normalizedKey),
    schema,
    key: normalizedKey,
    subjectRef,
    objectRef,
    value,
    payload,
    sourceEventId,
    confidence,
    importance,
    stability,
    confirmations,
    firstSeenAt,
    lastSeenAt,
    lastUsedAt,
    priority,
    status
  }
}

function createBeliefItem({
  keyParts,
  subjectRef,
  objectRef = null,
  value = null,
  payload = {},
  sourceEventId,
  timestamp,
  confidence = 0.7,
  importance = 55,
  stability = 0.6,
  priority = MEMORY_PRIORITY.MEDIUM
}) {
  const key = buildCanonicalKey(keyParts)

  return createCanonicalItem({
    schema: CANONICAL_SCHEMA.BELIEF,
    key,
    subjectRef,
    objectRef,
    value,
    payload,
    sourceEventId,
    confidence,
    importance,
    stability,
    confirmations: 1,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastUsedAt: null,
    priority
  })
}

function createEntityItem({
  keyParts,
  subjectRef,
  payload = {},
  sourceEventId,
  timestamp,
  confidence = 0.65,
  importance = 45,
  stability = 0.65,
  priority = MEMORY_PRIORITY.MEDIUM
}) {
  const key = buildCanonicalKey(keyParts)

  return createCanonicalItem({
    schema: CANONICAL_SCHEMA.ENTITY,
    key,
    subjectRef,
    payload,
    sourceEventId,
    confidence,
    importance,
    stability,
    confirmations: 1,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastUsedAt: null,
    priority
  })
}

function createRelationshipSignalItem({
  keyParts,
  subjectRef,
  objectRef,
  payload = {},
  sourceEventId,
  timestamp,
  confidence = 0.7,
  importance = 60,
  stability = 0.45,
  priority = MEMORY_PRIORITY.HIGH
}) {
  const key = buildCanonicalKey(keyParts)

  return createCanonicalItem({
    schema: CANONICAL_SCHEMA.RELATIONSHIP_SIGNAL,
    key,
    subjectRef,
    objectRef,
    payload,
    sourceEventId,
    confidence,
    importance,
    stability,
    confirmations: 1,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastUsedAt: null,
    priority
  })
}

function createOpenLoopItem({
  keyParts,
  subjectRef,
  objectRef = null,
  payload = {},
  sourceEventId,
  timestamp,
  confidence = 0.65,
  importance = 55,
  stability = 0.4,
  priority = MEMORY_PRIORITY.MEDIUM
}) {
  const key = buildCanonicalKey(keyParts)

  return createCanonicalItem({
    schema: CANONICAL_SCHEMA.OPEN_LOOP,
    key,
    subjectRef,
    objectRef,
    payload,
    sourceEventId,
    confidence,
    importance,
    stability,
    confirmations: 1,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastUsedAt: null,
    priority
  })
}

function createEpisodeStubItem({
  keyParts,
  subjectRef,
  payload = {},
  sourceEventId,
  timestamp,
  confidence = 0.7,
  importance = 65,
  stability = 0.75,
  priority = MEMORY_PRIORITY.HIGH
}) {
  const key = buildCanonicalKey(keyParts)

  return createCanonicalItem({
    schema: CANONICAL_SCHEMA.EPISODE_STUB,
    key,
    subjectRef,
    payload,
    sourceEventId,
    confidence,
    importance,
    stability,
    confirmations: 1,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastUsedAt: null,
    priority
  })
}

module.exports = {
  createCanonicalItem,
  createBeliefItem,
  createEntityItem,
  createRelationshipSignalItem,
  createOpenLoopItem,
  createEpisodeStubItem
}