'use strict'

function buildFallbackDedupeKey(item) {
  return [
    item.type,
    item.subtype || '',
    item.normalizedText || item.text || '',
    item.actor?.ref || item.actor?.role || '',
    item.target?.ref || item.target?.role || ''
  ].join('::')
}

function dedupeByBestScore(items) {
  const map = new Map()

  for (const item of items || []) {
    const key = item.dedupeKeyHint || buildFallbackDedupeKey(item)
    const existing = map.get(key)

    if (!existing || (item.confidence || 0) > (existing.confidence || 0)) {
      map.set(key, item)
    }
  }

  return Array.from(map.values())
}

module.exports = {
  dedupeByBestScore
}