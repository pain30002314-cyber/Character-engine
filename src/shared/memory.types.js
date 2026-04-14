/**
 * Сырый event диалога.
 *
 * @typedef {Object} MemoryEvent
 * @property {string} id
 * @property {string} threadId
 * @property {'user'|'assistant'|'system'} role
 * @property {string} text
 * @property {string} platform
 * @property {string} channel
 * @property {string} world
 * @property {string} timestamp
 * @property {Object} meta
 */

const MEMORY_ITEM_STATUS = {
  ACTIVE: 'active',
  STALE: 'stale',
  ARCHIVED: 'archived',
  CONTRADICTED: 'contradicted',
  RESOLVED: 'resolved'
}

const MEMORY_PRIORITY = {
  SACRED: 'sacred',
  HIGH: 'high',
  MEDIUM: 'medium',
  DISPOSABLE: 'disposable'
}

const CANONICAL_SCHEMA = {
  BELIEF: 'belief',
  ENTITY: 'entity',
  RELATIONSHIP_SIGNAL: 'relationship_signal',
  OPEN_LOOP: 'open_loop',
  EPISODE_STUB: 'episode_stub',
  IDENTITY_CLAIM: 'identity_claim'
}

const RAW_CLAIM_TYPE = {
  FACT: 'fact',
  ENTITY: 'entity',
  RELATIONSHIP: 'relationship',
  OPEN_LOOP: 'open_loop',
  EPISODE: 'episode'
}

module.exports = {
  MEMORY_ITEM_STATUS,
  MEMORY_PRIORITY,
  CANONICAL_SCHEMA,
  RAW_CLAIM_TYPE
}