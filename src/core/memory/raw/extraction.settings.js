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
  debugLog: normalizeBoolean(process.env.MEMORY_EXTRACTION_DEBUG, false),
  wideLlmExtractorEnabled: normalizeBoolean(
    process.env.MEMORY_WIDE_LLM_EXTRACTOR_ENABLED,
    false
  ),
  disablePersistenceWrite: normalizeBoolean(
    process.env.MEMORY_DISABLE_PERSISTENCE_WRITE,
    true
  )
}

function shouldUseWideLlmRuntime(settings = extractionSettings) {
  if (!settings?.wideLlmExtractorEnabled) {
    return false
  }

  return settings.mode === 'llm_only' || settings.mode === 'hybrid'
}

function shouldRunRegexObserve(settings = extractionSettings) {
  return settings.mode === 'heuristic_only' || settings.mode === 'hybrid'
}

module.exports = extractionSettings
module.exports.normalizeMode = normalizeMode
module.exports.normalizeBoolean = normalizeBoolean
module.exports.shouldUseWideLlmRuntime = shouldUseWideLlmRuntime
module.exports.shouldRunRegexObserve = shouldRunRegexObserve
