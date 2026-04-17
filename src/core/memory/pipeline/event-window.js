'use strict'

function trimText(value, maxLen) {
  const text = String(value || '').trim()

  if (text.length <= maxLen) {
    return text
  }

  return `${text.slice(0, maxLen)}...`
}

function buildEventWindow(events, maxEvents, maxCharsPerEvent) {
  return (Array.isArray(events) ? events : [])
    .slice(-maxEvents)
    .map((event) => ({
      id: event?.id || null,
      role: event?.role || null,
      timestamp: event?.timestamp || null,
      text: trimText(event?.text, maxCharsPerEvent)
    }))
}

module.exports = {
  buildEventWindow
}
