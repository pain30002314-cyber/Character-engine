/**
 * Единый формат входящего сообщения для core.
 *
 * @typedef {Object} CoreInputMessage
 * @property {string} platform
 * @property {string} channel
 * @property {string} threadId
 * @property {string} text
 * @property {string|number|null} userId
 * @property {string|null} username
 * @property {string|number|null} chatId
 * @property {string} world
 * @property {string} timestamp
 */

/**
 * @param {Partial<CoreInputMessage>} input
 * @returns {CoreInputMessage}
 */
function normalizeInputMessage(input = {}) {
  return {
    platform: input.platform || 'unknown',
    channel: input.channel || 'text',
    threadId: String(input.threadId || ''),
    text: String(input.text || ''),
    userId: input.userId ?? null,
    username: input.username ?? null,
    chatId: input.chatId ?? null,
    world: input.world || 'Earth',
    timestamp: input.timestamp || new Date().toISOString()
  }
}

module.exports = {
  normalizeInputMessage
}