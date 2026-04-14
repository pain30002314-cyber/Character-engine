const { MEMORY_PRIORITY } = require('../../../shared/memory.types')

function getDefaultPriorityForSchema(schema) {
  switch (schema) {
    case 'identity_claim':
      return MEMORY_PRIORITY.SACRED
    case 'relationship_signal':
      return MEMORY_PRIORITY.HIGH
    case 'episode_stub':
      return MEMORY_PRIORITY.HIGH
    case 'belief':
      return MEMORY_PRIORITY.MEDIUM
    case 'entity':
      return MEMORY_PRIORITY.MEDIUM
    case 'open_loop':
      return MEMORY_PRIORITY.MEDIUM
    default:
      return MEMORY_PRIORITY.DISPOSABLE
  }
}

module.exports = {
  getDefaultPriorityForSchema
}