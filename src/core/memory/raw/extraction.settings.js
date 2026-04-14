function normalizeMode(value) {
  const mode = String(value || 'hybrid').trim().toLowerCase()

  if (['heuristic_only', 'llm_only', 'hybrid'].includes(mode)) {
    return mode
  }

  return 'hybrid'
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

const extractionSettings = {
  mode: normalizeMode(process.env.MEMORY_EXTRACTION_MODE),
  debugLog: normalizeBoolean(process.env.MEMORY_EXTRACTION_DEBUG, false)
}

module.exports = extractionSettings