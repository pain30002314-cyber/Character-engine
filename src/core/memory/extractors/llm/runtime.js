'use strict'

const { writeMemoryDebug } = require('../../debug/memory-debug.service')
const {
  LLM_EXTRACTOR_FLOW_CONFIG
} = require('./config/extractor-passes.config')
const { orchestrateWideLlmExtraction } = require('./orchestrator')
const { createTraceId } = require('./utils/ids')
const { buildBaseEventPacket } = require('./shared/build-base-event-packet')
const { getRegisteredExtractorPasses } = require('./passes/registry')
const { logBasePacket } = require('./logging/log-base-packet')
const { writeFailureLog } = require('./logging/write-failure-log')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function buildFallbackEvent(event) {
  return {
    id: event?.id || null,
    threadId: event?.threadId || null,
    role: event?.role || 'user',
    platform: event?.platform || null,
    channel: event?.channel || null,
    world: event?.world || null,
    timestamp: event?.timestamp || null,
    text: event?.text || '',
    meta: event?.meta || {}
  }
}

function buildWindowPreview(eventWindow) {
  return safeArray(eventWindow).map((item, index) => ({
    index,
    id: item?.id || null,
    role: item?.role || null,
    timestamp: item?.timestamp || null,
    text: item?.text || ''
  }))
}

function buildIdentityContext(context = {}) {
  return {
    coreUserRef: context?.identity?.coreUserRef || 'core_user:main',
    coreCharacterRef: context?.identity?.coreCharacterRef || 'core_character:active',
    userDisplayName: context?.identity?.userDisplayName || null,
    characterDisplayName: context?.identity?.characterDisplayName || null
  }
}

function buildBasePacket({ event, eventWindow, context, flowConfig, durationMs = 0, warnings = [] }) {
  return {
    version: 1,
    strategy: flowConfig.strategy,
    event: buildFallbackEvent(event),
    context: {
      eventWindow: buildWindowPreview(eventWindow),
      identity: buildIdentityContext(context)
    },
    candidates: [],
    temporal: {
      messageTime: event?.timestamp || null,
      anchors: []
    },
    meta: {
      source: 'llm',
      strategy: flowConfig.strategy,
      promptTransport: flowConfig.promptTransport,
      responseContract: flowConfig.responseContract,
      extractorVersion: flowConfig.extractorVersion,
      durationMs
    },
    service: {
      extractorVersion: flowConfig.extractorVersion,
      processedAt: new Date().toISOString(),
      durationMs,
      stats: {
        eventWindowSize: safeArray(eventWindow).length,
        candidates: 0,
        passesTotal: 0,
        passesSucceeded: 0,
        passesFailed: 0
      },
      warnings,
      debug: {}
    },
    debug: {
      warnings
    },
    orchestration: null
  }
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

async function runLlmExtractionRuntime({
  event,
  eventWindow = [],
  context = {},
  passes = null,
  llm = {},
  runtime = {}
}) {
  const startedAt = Date.now()
  const flowConfig = {
    ...LLM_EXTRACTOR_FLOW_CONFIG,
    ...(runtime?.flowConfig || {})
  }
  const traceId = runtime?.traceId || createTraceId('llm_trace')
  const passPlan = resolvePassPlan(passes)
  const runtimeBaseEventPacket = buildBaseEventPacket({
    pass: null,
    event,
    eventWindow,
    context
  })
  const effectiveRuntime = {
    ...runtime,
    traceId,
    flowConfig
  }

  await logBasePacket({
    traceId,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    platform: runtimeBaseEventPacket?.event?.platform || null,
    channel: runtimeBaseEventPacket?.event?.channel || null,
    speakerRole: runtimeBaseEventPacket?.event?.speakerRole || null,
    speakerName: runtimeBaseEventPacket?.event?.speakerName || null,
    timestampIso: runtimeBaseEventPacket?.event?.timestampIso || null,
    localizedTime: runtimeBaseEventPacket?.event?.localizedTime || null,
    promptLanguage: runtimeBaseEventPacket?.promptLanguageCode || null,
    messageText: runtimeBaseEventPacket?.event?.messageText || '',
    recentContextCount: safeArray(runtimeBaseEventPacket?.recentContext).length,
    fastSignals: safeArray(runtimeBaseEventPacket?.fastSignals),
    extractorPlan: passPlan.map((pass) => ({
      extractorKey: pass.extractorKey,
      extractorName: pass.extractorName,
      role: pass.role || null
    })),
    warnings: [],
    errors: []
  })

  try {
    const orchestration = await orchestrateWideLlmExtraction({
      event,
      eventWindow,
      context,
      passes,
      llm,
      runtime: effectiveRuntime
    })

    const durationMs = Date.now() - startedAt
    const packet = buildBasePacket({
      event,
      eventWindow,
      context,
      flowConfig,
      durationMs,
      warnings: orchestration.warnings
    })

    packet.candidates = orchestration.candidates
    packet.service = {
      ...packet.service,
      durationMs,
      stats: {
        eventWindowSize: safeArray(eventWindow).length,
        candidates: orchestration.candidates.length,
        passesTotal: orchestration.passes.configured,
        passesSucceeded: orchestration.passes.successful.length,
        passesFailed: orchestration.passes.failed.length
      },
      warnings: orchestration.warnings,
      debug: {
        status: orchestration.status,
        partialFailure: orchestration.passes.partialFailure
      }
    }
    packet.debug = {
      warnings: orchestration.warnings
    }
    packet.orchestration = orchestration
    packet.persistencePacket = orchestration.persistencePacket || null
    packet.traceId = traceId

    writeMemoryDebug({
      layer: 'llm-extractor-runtime',
      timestamp: new Date().toISOString(),
      threadId: event?.threadId || null,
      messageId: event?.id || null,
      eventId: event?.id || null,
      sourceEventId: event?.id || null,
      input: {
        event: buildFallbackEvent(event),
        eventWindowSize: safeArray(eventWindow).length
      },
      output: {
        strategy: packet.strategy,
        candidateCount: packet.candidates.length,
        passesSucceeded: packet.service.stats.passesSucceeded,
        passesFailed: packet.service.stats.passesFailed
      },
      meta: {
        durationMs,
        extractorVersion: flowConfig.extractorVersion
      },
      errors: orchestration.passes.failed.map((item) => item.error.message)
    })

    return packet
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const warnings = [error?.message || 'llm_extraction_runtime_failed']
    const packet = buildBasePacket({
      event,
      eventWindow,
      context,
      flowConfig,
      durationMs,
      warnings
    })
    packet.traceId = traceId

    writeMemoryDebug({
      layer: 'llm-extractor-runtime',
      timestamp: new Date().toISOString(),
      threadId: event?.threadId || null,
      messageId: event?.id || null,
      eventId: event?.id || null,
      sourceEventId: event?.id || null,
      input: {
        event: buildFallbackEvent(event),
        eventWindowSize: safeArray(eventWindow).length
      },
      output: {
        strategy: packet.strategy,
        candidateCount: 0,
        passesSucceeded: 0,
        passesFailed: 0
      },
      meta: {
        durationMs,
        extractorVersion: flowConfig.extractorVersion
      },
      errors: warnings
    })

    await writeFailureLog({
      traceId,
      eventId: event?.id || null,
      threadId: event?.threadId || null,
      failedStage: 'runtime',
      status: 'failed',
      durationMs,
      warnings: [],
      errors: warnings,
      note: error?.code || 'llm_extraction_runtime_failed',
      error
    })

    return packet
  }
}

async function extractLlmAtomsV1(input) {
  return runLlmExtractionRuntime(input)
}

async function extractLlmClaims(input) {
  return runLlmExtractionRuntime(input)
}

module.exports = {
  runLlmExtractionRuntime,
  extractLlmAtomsV1,
  extractLlmClaims
}
