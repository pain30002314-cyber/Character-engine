'use strict'

const { normalizeMultilineText } = require('./text')

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function safeJsonParse(source) {
  try {
    return {
      ok: true,
      value: JSON.parse(source)
    }
  } catch (error) {
    return {
      ok: false,
      error
    }
  }
}

function stripMarkdownCodeFences(value) {
  const source = String(value || '').trim()

  if (!source.startsWith('```')) {
    return source
  }

  return source
    .replace(/^```[a-zа-я0-9_-]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function findBalancedJsonFragment(source) {
  const text = String(source || '')
  const startIndex = text.search(/[{[]/)

  if (startIndex === -1) {
    return null
  }

  const opening = text[startIndex]
  const closing = opening === '{' ? '}' : ']'

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === opening) {
      depth += 1
      continue
    }

    if (char === closing) {
      depth -= 1
      if (depth === 0) {
        return text.slice(startIndex, index + 1)
      }
    }
  }

  return text.slice(startIndex).trim() || null
}

function appendMissingClosers(value) {
  const text = String(value || '').trim()
  if (!text) return text

  let inString = false
  let escaped = false
  let objectDepth = 0
  let arrayDepth = 0

  for (const char of text) {
    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') objectDepth += 1
    if (char === '}') objectDepth = Math.max(0, objectDepth - 1)
    if (char === '[') arrayDepth += 1
    if (char === ']') arrayDepth = Math.max(0, arrayDepth - 1)
  }

  return `${text}${']'.repeat(arrayDepth)}${'}'.repeat(objectDepth)}`
}

function stripTrailingCommas(value) {
  return String(value || '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

function normalizeJsonText(value) {
  return normalizeMultilineText(value)
}

module.exports = {
  isPlainObject,
  safeArray,
  safeJsonParse,
  stripMarkdownCodeFences,
  findBalancedJsonFragment,
  appendMissingClosers,
  stripTrailingCommas,
  normalizeJsonText
}
