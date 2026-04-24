'use strict'

const {
  writeMemoryDebug,
  writeMemoryLiveTrace
} = require('../../debug/memory-debug.service')
const {
  LLM_EXTRACTOR_FLOW_CONFIG
} = require('./config/extractor-passes.config')
const { orchestrateWideLlmExtraction } = require('./orchestrator')
const { buildBaseEventPacket } = require('./shared/build-base-event-packet')
const { getRegisteredExtractorPasses } = require('./passes/registry')
const { logBasePacket } = require('./logging/log-base-packet')
const { writeFailureLog } = require('./logging/write-failure-log')
const { createTraceId } = require('./utils/ids')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function resolvePassPlan(requestedPasses) {
  const configuredPasses = getRegisteredExtractorPasses()

  if (!Array.isArray(requestedPasses) || requestedPasses.length === 0) {
    return configuredPasses
  }

  const requestedKeys = new Set(
    requestedPasses
      .map((item) => {
        if (item && typeof item === 'object') {
          return String(item.extractorKey || '').trim()
        }

        return String(item || '').trim()
      })
      .filter(Boolean)
  )

  return configuredPasses.filter((pass) => requestedKeys.has(pass.extractorKey))
}

function buildServicePacket({
  extractorVersion,
  durationMs,
  eventWindow,
  orchestration,
  warnings,
  status
}) {
  const passes = orchestration?.passes || {}
  const candidates = safeArray(orchestration?.candidates)

  return {
    extractorVersion,
    processedAt: new Date().toISOString(),
    durationMs,
    stats: {
      eventWindowSize: safeArray(eventWindow).length,
      candidates: candidates.length,
      passesTotal: Number(passes.configured || 0),
      passesSucceeded: safeArray(passes.successful).length,
      passesFailed: safeArray(passes.failed).length
    },
    warnings,
    debug: {
      status,
      partialFailure: Boolean(passes.partialFailure)
    }
  }
}

async function runLlmExtractionRuntime({
  event,
  eventWindow = [],
  context = {},
  passes = null,
  llm = {},
  runtime = {}
}) {
  const startedAt = Date.now()
  const baseEventPacket = buildBaseEventPacket({
    pass: null,
    event,
    eventWindow,
    context
  })
  const passPlan = resolvePassPlan(passes)
  const traceId = runtime?.traceId || baseEventPacket?.traceId || createTraceId('llm_trace')
  const extractorVersion =
    runtime?.flowConfig?.extractorVersion ||
    LLM_EXTRACTOR_FLOW_CONFIG.extractorVersion

  if (!baseEventPacket.traceId) {
    baseEventPacket.traceId = traceId
  }

  await logBasePacket({
    traceId,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    platform: baseEventPacket?.event?.platform || null,
    channel: baseEventPacket?.event?.channel || null,
    speakerRole: baseEventPacket?.event?.speakerRole || null,
    speakerName: baseEventPacket?.event?.speakerName || null,
    timestampIso: baseEventPacket?.event?.timestampIso || null,
    localizedTime: baseEventPacket?.event?.localizedTime || null,
    promptLanguage: baseEventPacket?.promptLanguageCode || null,
    messageText: baseEventPacket?.event?.messageText || '',
    recentContextCount: safeArray(baseEventPacket?.recentContext).length,
    fastSignals: safeArray(baseEventPacket?.fastSignals),
    extractorPlan: passPlan.map((pass) => ({
      extractorKey: pass.extractorKey,
      extractorName: pass.extractorName,
      role: pass.role || null
    })),
    warnings: [],
    errors: []
  })

  writeMemoryLiveTrace({
    marker: 'wide_llm_runtime_started',
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    messageId: event?.id || null,
    memoryExtractionMode: runtime?.flowConfig?.mode || process.env.MEMORY_EXTRACTION_MODE || null,
    wideLlmExtractorEnabled: process.env.MEMORY_WIDE_LLM_EXTRACTOR_ENABLED === 'true',
    disablePersistenceWrite: process.env.MEMORY_DISABLE_PERSISTENCE_WRITE !== 'false',
    note: 'runLlmExtractionRuntime'
  })

  try {
    const orchestration = await orchestrateWideLlmExtraction({
      event,
      eventWindow,
      context,
      passes,
      llm,
      runtime: {
        ...runtime,
        traceId
      }
    })
    const durationMs = Date.now() - startedAt
    const warnings = safeArray(orchestration?.warnings)
    const result = {
      traceId,
      eventId: event?.id || null,
      threadId: event?.threadId || null,
      service: buildServicePacket({
        extractorVersion,
        durationMs,
        eventWindow,
        orchestration,
        warnings,
        status: orchestration?.status || 'ok'
      }),
      orchestration,
      candidatePool: orchestration?.candidatePool || null,
      persistencePacket: orchestration?.persistencePacket || null,
      candidates: safeArray(orchestration?.candidates),
      warnings
    }

    writeMemoryDebug({
      layer: 'llm-extractor-runtime',
      timestamp: new Date().toISOString(),
      threadId: result.threadId,
      messageId: result.eventId,
      eventId: result.eventId,
      sourceEventId: result.eventId,
      input: {
        traceId,
        eventId: result.eventId,
        eventWindowSize: safeArray(eventWindow).length
      },
      output: {
        candidateCount: result.candidates.length,
        status: orchestration?.status || 'ok'
      },
      meta: {
        durationMs,
        extractorVersion
      },
      errors: safeArray(orchestration?.passes?.failed).map(
        (item) => item?.error?.message || 'extractor_pass_failed'
      )
    })

    writeMemoryLiveTrace({
      marker: 'wide_llm_runtime_finished',
      eventId: result.eventId,
      threadId: result.threadId,
      messageId: result.eventId,
      memoryExtractionMode: runtime?.flowConfig?.mode || process.env.MEMORY_EXTRACTION_MODE || null,
      wideLlmExtractorEnabled: process.env.MEMORY_WIDE_LLM_EXTRACTOR_ENABLED === 'true',
      disablePersistenceWrite: process.env.MEMORY_DISABLE_PERSISTENCE_WRITE !== 'false',
      note: orchestration?.status || 'ok'
    })

    return result
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const warnings = [error?.message || 'llm_extraction_runtime_failed']
    const result = {
      traceId,
      eventId: event?.id || null,
      threadId: event?.threadId || null,
      service: buildServicePacket({
        extractorVersion,
        durationMs,
        eventWindow,
        orchestration: null,
        warnings,
        status: 'failed'
      }),
      orchestration: null,
      candidatePool: null,
      persistencePacket: null,
      candidates: [],
      warnings
    }

    writeMemoryDebug({
      layer: 'llm-extractor-runtime',
      timestamp: new Date().toISOString(),
      threadId: result.threadId,
      messageId: result.eventId,
      eventId: result.eventId,
      sourceEventId: result.eventId,
      input: {
        traceId,
        eventId: result.eventId,
        eventWindowSize: safeArray(eventWindow).length
      },
      output: {
        candidateCount: 0,
        status: 'failed'
      },
      meta: {
        durationMs,
        extractorVersion
      },
      errors: warnings
    })

    await writeFailureLog({
      traceId,
      eventId: result.eventId,
      threadId: result.threadId,
      failedStage: 'runtime',
      status: 'failed',
      durationMs,
      warnings: [],
      errors: warnings,
      note: error?.code || 'llm_extraction_runtime_failed',
      error
    })

    writeMemoryLiveTrace({
      marker: 'wide_llm_runtime_finished',
      eventId: result.eventId,
      threadId: result.threadId,
      messageId: result.eventId,
      memoryExtractionMode: runtime?.flowConfig?.mode || process.env.MEMORY_EXTRACTION_MODE || null,
      wideLlmExtractorEnabled: process.env.MEMORY_WIDE_LLM_EXTRACTOR_ENABLED === 'true',
      disablePersistenceWrite: process.env.MEMORY_DISABLE_PERSISTENCE_WRITE !== 'false',
      note: 'failed'
    })

    return result
  }
}

const runLlmExtractor = runLlmExtractionRuntime
const extractLlmAtomsV1 = runLlmExtractionRuntime
const extractLlmClaims = runLlmExtractionRuntime

module.exports = {
  runLlmExtractionRuntime,
  runLlmExtractor,
  extractLlmAtomsV1,
  extractLlmClaims
}
