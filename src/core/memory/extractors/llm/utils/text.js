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

const OVERLAP_STOP_WORDS = new Set([
  'и',
  'в',
  'на',
  'по',
  'что',
  'это',
  'как',
  'мы',
  'ты',
  'он',
  'она',
  'они',
  'для',
  'без',
  'уже',
  'еще',
  'тут',
  'там',
  'вот',
  'давай',
  'надо'
])

function normalizeForOverlap(value) {
  const tokens = normalizeInlineText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((item) => item.trim())
    .filter((item) => item.length > 2)
    .filter((item) => !OVERLAP_STOP_WORDS.has(item))

  return {
    text: tokens.join(' '),
    words: tokens
  }
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
  normalizeForOverlap,
  toSafeKey
}
