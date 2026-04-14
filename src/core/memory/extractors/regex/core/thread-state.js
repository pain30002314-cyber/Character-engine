'use strict'

function buildThreadState(event, currentState = {}) {
  const timestamp = event?.timestamp || null
  const role = event?.role || null

  return {
    firstSeenAt: currentState.firstSeenAt || timestamp,
    lastSeenAt: timestamp,
    lastUserMessageAt: role === 'user' ? timestamp : currentState.lastUserMessageAt || null,
    lastAssistantMessageAt:
      role === 'assistant' ? timestamp : currentState.lastAssistantMessageAt || null,
    messageCount: Number(currentState.messageCount || 0) + 1
  }
}

module.exports = {
  buildThreadState
}