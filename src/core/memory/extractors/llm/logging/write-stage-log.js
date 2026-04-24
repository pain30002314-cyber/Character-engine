'use strict'

const fs = require('node:fs/promises')

const {
  LLM_LOGGING_CONFIG,
  resolveLogPathByStage
} = require('../config/logging.config')
const { isKnownLogStage } = require('../registries/log-stage.registry')

const ensuredDirectories = new Map()

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function ensureDirectory(dirPath) {
  if (!dirPath) {
    return Promise.resolve()
  }

  if (!ensuredDirectories.has(dirPath)) {
    ensuredDirectories.set(
      dirPath,
      fs.mkdir(dirPath, {
        recursive: true
      })
    )
  }

  return ensuredDirectories.get(dirPath)
}

function serializeLogEntry(entry) {
  return JSON.stringify(entry) + LLM_LOGGING_CONFIG.lineDelimiter
}

function normalizeLogEntry(stage, payload = {}) {
  const normalizedStage = String(payload.stage || stage || '').trim() || null
  const normalizedWarnings = safeArray(payload.warnings)
  const normalizedErrors = safeArray(payload.errors)
  const normalizedCounts =
    payload.counts && typeof payload.counts === 'object' ? payload.counts : {}

  return {
    ...payload,
    logVersion: payload.logVersion || LLM_LOGGING_CONFIG.logVersion,
    timestamp: payload.timestamp || new Date().toISOString(),
    traceId: payload.traceId || null,
    eventId: payload.eventId || null,
    threadId: payload.threadId || null,
    stage: normalizedStage,
    status: payload.status || 'unknown',
    extractorName:
      payload.extractorName === undefined ? null : payload.extractorName,
    sourcePass: payload.sourcePass === undefined ? null : payload.sourcePass,
    durationMs:
      payload.durationMs === undefined || payload.durationMs === null
        ? null
        : Number(payload.durationMs),
    warnings: normalizedWarnings,
    errors: normalizedErrors,
    counts: normalizedCounts,
    note: payload.note == null ? null : String(payload.note)
  }
}

async function writeStageLog({
  stage,
  entry
}) {
  const normalizedStage = String(stage || '').trim()

  if (!isKnownLogStage(normalizedStage)) {
    return {
      ok: false,
      stage: normalizedStage,
      filePath: null,
      reason: 'unknown_log_stage'
    }
  }

  const filePath = resolveLogPathByStage(normalizedStage)

  if (!filePath) {
    return {
      ok: false,
      stage: normalizedStage,
      filePath: null,
      reason: 'log_stage_path_missing'
    }
  }

  try {
    await ensureDirectory(LLM_LOGGING_CONFIG.rootDir)
    await fs.appendFile(
      filePath,
      serializeLogEntry(normalizeLogEntry(normalizedStage, entry)),
      'utf8'
    )

    return {
      ok: true,
      stage: normalizedStage,
      filePath
    }
  } catch (error) {
    return {
      ok: false,
      stage: normalizedStage,
      filePath,
      reason: error?.message || 'stage_log_write_failed'
    }
  }
}

module.exports = {
  writeStageLog
}
