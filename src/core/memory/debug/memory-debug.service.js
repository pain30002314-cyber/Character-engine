'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_DEBUG_ROOT = path.join(
  process.cwd(),
  'data',
  'debug',
  'memory-pipeline'
)
const STAGE_ENV_FLAGS = {
  'raw-extraction': 'MEMORY_EXTRACTION_DEBUG'
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toPlainObject(value) {
  return isPlainObject(value) ? value : {}
}

function toStringOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return String(value)
}

function normalizeStageName(value) {
  const normalized = String(value || 'unknown_stage')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'unknown_stage'
}

function normalizePathSegment(value, fallback) {
  const normalized = String(value || fallback || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || fallback
}

function resolveDebugRoot(options = {}) {
  return options.baseDir || process.env.MEMORY_PIPELINE_DEBUG_DIR || process.env.MEMORY_DEBUG_DIR || DEFAULT_DEBUG_ROOT
}

function isMemoryDebugEnabled(layer, options = {}) {
  if (typeof options.enabled === 'boolean') {
    return options.enabled
  }

  if (process.env.MEMORY_PIPELINE_DEBUG !== undefined) {
    return normalizeBoolean(process.env.MEMORY_PIPELINE_DEBUG, true)
  }

  if (process.env.MEMORY_DEBUG !== undefined) {
    return normalizeBoolean(process.env.MEMORY_DEBUG, true)
  }

  const envFlag = STAGE_ENV_FLAGS[normalizeStageName(layer)]
  if (envFlag && process.env[envFlag] !== undefined) {
    return normalizeBoolean(process.env[envFlag], false)
  }

  return true
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function buildMemoryDebugPacket({
  layer,
  timestamp,
  threadId,
  messageId,
  eventId,
  sourceEventId,
  input,
  output,
  meta,
  errors
}) {
  const normalizedLayer = normalizeStageName(layer)
  const normalizedErrors = Array.isArray(errors)
    ? errors.filter((item) => item !== undefined && item !== null && item !== '')
    : []

  return {
    layer: normalizedLayer,
    timestamp: toStringOrNull(timestamp) || new Date().toISOString(),
    threadId: toStringOrNull(threadId),
    messageId: toStringOrNull(messageId),
    eventId: toStringOrNull(eventId),
    sourceEventId: toStringOrNull(sourceEventId),
    input: input === undefined ? null : input,
    output: output === undefined ? null : output,
    meta: toPlainObject(meta),
    errors: normalizedErrors
  }
}

function safeJson(value) {
  try {
    return JSON.stringify(value)
  } catch (error) {
    return JSON.stringify({
      layer: value?.layer || 'unknown_stage',
      timestamp: new Date().toISOString(),
      input: null,
      output: null,
      meta: {
        serializationError: error.message
      },
      errors: ['failed_to_serialize_debug_packet']
    })
  }
}

function buildDebugFilePath(packet, options = {}) {
  const rootDir = resolveDebugRoot(options)
  const stageFileName = `${normalizePathSegment(packet.layer, 'unknown_stage')}.jsonl`
  return path.join(rootDir, stageFileName)
}

function writeMemoryDebug(payload, options = {}) {
  const packet = buildMemoryDebugPacket(payload)

  if (!isMemoryDebugEnabled(packet.layer, options)) {
    return {
      enabled: false,
      packet,
      filePath: null
    }
  }

  const filePath = buildDebugFilePath(packet, options)
  ensureDirectory(path.dirname(filePath))
  fs.appendFileSync(filePath, `${safeJson(packet)}\n`, 'utf-8')

  return {
    enabled: true,
    packet,
    filePath
  }
}

module.exports = {
  DEFAULT_DEBUG_ROOT,
  buildMemoryDebugPacket,
  buildDebugFilePath,
  isMemoryDebugEnabled,
  writeMemoryDebug
}
