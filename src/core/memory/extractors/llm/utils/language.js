'use strict'

const ALLOWED_IMPORTANCE = new Set(['низкая', 'средняя', 'высокая'])

function normalizePromptLanguage(value, fallback = 'ru') {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized) {
    return fallback
  }

  if (normalized === 'русский') {
    return 'ru'
  }

  return normalized
}

function normalizeImportanceLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ALLOWED_IMPORTANCE.has(normalized) ? normalized : null
}

module.exports = {
  normalizePromptLanguage,
  normalizeImportanceLabel,
  ALLOWED_IMPORTANCE
}
