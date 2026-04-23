'use strict'

function getNowIso() {
  return new Date().toISOString()
}

function getDurationMs(startedAt) {
  return Math.max(0, Date.now() - Number(startedAt || Date.now()))
}

function resolveEventTimestampIso(event, fallback = null) {
  const timestamp = event?.timestamp != null ? String(event.timestamp).trim() : ''
  return timestamp || fallback || getNowIso()
}

module.exports = {
  getNowIso,
  getDurationMs,
  resolveEventTimestampIso
}
