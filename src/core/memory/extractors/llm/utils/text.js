'use strict'

function normalizeMultilineText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeInlineText(value) {
  return normalizeMultilineText(value).replace(/\n+/g, ' ').trim()
}

function trimText(value, maxLength) {
  const text = normalizeMultilineText(value)

  if (!maxLength || text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength).trim()}...`
}

function sanitizeTag(value) {
  const text = normalizeInlineText(value)
  return text || null
}

function sanitizeTagList(value, limit = 8) {
  const tags = Array.isArray(value) ? value : []
  const result = []

  for (const item of tags) {
    const normalized = sanitizeTag(item)
    if (!normalized) continue
    if (result.includes(normalized)) continue
    result.push(normalized)
    if (result.length >= limit) break
  }

  return result
}

function toSafeKey(value, fallback = 'candidate') {
  const normalized = normalizeInlineText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || fallback
}

module.exports = {
  normalizeMultilineText,
  normalizeInlineText,
  trimText,
  sanitizeTag,
  sanitizeTagList,
  toSafeKey
}
