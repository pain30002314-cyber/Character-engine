'use strict'

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanupPunctuation(text) {
  return String(text || '')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([,.;!?])([^\s])/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function normalizeText(text) {
  return cleanupPunctuation(normalizeWhitespace(text))
}

function extractRpBlocks(text) {
  const source = String(text || '')
  const result = []
  const regex = /\*([^*\n][\s\S]*?)\*/g
  let match

  while ((match = regex.exec(source))) {
    const value = normalizeText(match[1])
    if (value) result.push(value)
  }

  return result
}

function stripRpBlocks(text) {
  return normalizeText(String(text || '').replace(/\*([^*\n][\s\S]*?)\*/g, ' '))
}

function buildPreprocessedEvent(event) {
  const rawText = String(event?.text || '')
  const normalizedText = normalizeText(rawText)
  const rpBlocks = extractRpBlocks(rawText)
  const plainText = stripRpBlocks(rawText)
  const loweredText = plainText.toLowerCase()

  return {
    event: {
      ...event,
      text: rawText
    },
    rawText,
    normalizedText,
    plainText,
    loweredText,
    rpBlocks,
    hasRp: rpBlocks.length > 0
  }
}

module.exports = {
  normalizeWhitespace,
  cleanupPunctuation,
  normalizeText,
  extractRpBlocks,
  stripRpBlocks,
  buildPreprocessedEvent
}