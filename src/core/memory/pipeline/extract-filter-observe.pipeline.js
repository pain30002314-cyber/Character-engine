'use strict'

const extractionSettings = require('../raw/extraction.settings')
const { extractRegexAtoms } = require('../extractors/regex/runtime')
const { runLlmExtractionRuntime } = require('../extractors/llm')
const { logPersistence } = require('../extractors/llm/logging/log-persistence')
const { buildEventWindow } = require('./event-window')
const { writeMemoryLiveTrace } = require('../debug/memory-debug.service')

const DEFAULT_PIPELINE_LIMITS = {
  rawContextEvents: 8,
  rawContextCharsPerEvent: 280
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function mapRuntimeStatus(extractorPacket) {
  const status = extractorPacket?.orchestration?.status || extractorPacket?.service?.debug?.status || null

  switch (status) {
    case 'ok':
      return 'success'
    case 'partial':
      return 'partial'
    case 'failed':
      return 'failed'
    default:
      return extractorPacket?.orchestration ? 'success' : 'failed'
  }
}

function collectRuntimeErrors(extractorPacket) {
  const passErrors = safeArray(extractorPacket?.orchestration?.passes?.failed).map(
    (item) => item?.error?.message || 'extractor_pass_failed'
  )

  if (passErrors.length > 0) {
    return passErrors
  }

  if (!extractorPacket?.orchestration) {
    return safeArray(extractorPacket?.service?.warnings)
  }

  return []
}

function getRuntimeImplName(runtimeImpl) {
  if (runtimeImpl === runLlmExtractionRuntime) {
    return 'runLlmExtractionRuntime'
  }

  return runtimeImpl?.name || 'anonymous_runtime_impl'
}

function resolveWideRuntimeDecision({ settings, event, extractionConfig = {} }) {
  if (extractionConfig?.memoryDisabled === true) {
    return 'skipped_because_memory_disabled'
  }

  if (extractionConfig?.queueDisabled === true) {
    return 'skipped_because_queue_disabled'
  }

  if (!event) {
    return 'skipped_because_no_event'
  }

  if (!settings.wideLlmExtractorEnabled) {
    return 'skipped_because_disabled'
  }

  if (!(settings.mode === 'llm_only' || settings.mode === 'hybrid')) {
    return 'skipped_because_mode_not_llm'
  }

  return 'started'
}

async function logPersistenceSkip({
  traceId = null,
  eventId = null,
  threadId = null,
  storagePacket = null,
  warnings = [],
  errors = []
} = {}) {
  const resolutionMeta = storagePacket?.resolutionMeta || {}

  return logPersistence({
    traceId,
    eventId,
    threadId,
    status: 'skipped',
    durationMs: null,
    warnings,
    errors,
    counts: {
      nodeCount: resolutionMeta?.nodeCount || 0,
      factCount: resolutionMeta?.factCount || 0,
      episodeCount: resolutionMeta?.episodeCount || 0,
      edgeCount: resolutionMeta?.edgeCount || 0,
      derivedCount: resolutionMeta?.derivedCount || 0,
      reflectionCount: resolutionMeta?.reflectionCount || 0
    },
    note: 'persistence_skipped_by_config',
    storageTarget: 'disabled',
    createdNodesCount: 0,
    updatedNodesCount: 0,
    createdFactsCount: 0,
    updatedFactsCount: 0,
    createdEpisodesCount: 0,
    updatedEpisodesCount: 0,
    createdEdgesCount: 0,
    createdLinksCount: 0,
    persistedTargetsPreview: []
  })
}

async function runExtractFilterObservePipeline({
  threadId,
  event,
  history = [],
  eventWindow = null,
  pipelineLimits = {},
  extractionConfig = {},
  runtimeImpl = runLlmExtractionRuntime,
  regexExtractor = extractRegexAtoms
}) {
  const settings = {
    ...extractionSettings,
    ...(extractionConfig || {})
  }
  const resolvedLimits = {
    ...DEFAULT_PIPELINE_LIMITS,
    ...(pipelineLimits || {})
  }

  const resolvedThreadId = threadId || event?.threadId || null
  const runtimeImplName = getRuntimeImplName(runtimeImpl)
  const wideRuntimeDecision = resolveWideRuntimeDecision({
    settings,
    event,
    extractionConfig
  })

  writeMemoryLiveTrace({
    marker: 'extract_filter_observe_started',
    eventId: event?.id || null,
    threadId: resolvedThreadId,
    messageId: event?.id || null,
    memoryExtractionMode: settings.mode,
    wideLlmExtractorEnabled: settings.wideLlmExtractorEnabled,
    disablePersistenceWrite: settings.disablePersistenceWrite,
    note: `runtimeImpl=${runtimeImplName}`
  })

  writeMemoryLiveTrace({
    marker: 'wide_llm_runtime_decision',
    eventId: event?.id || null,
    threadId: resolvedThreadId,
    messageId: event?.id || null,
    memoryExtractionMode: settings.mode,
    wideLlmExtractorEnabled: settings.wideLlmExtractorEnabled,
    disablePersistenceWrite: settings.disablePersistenceWrite,
    note: `${wideRuntimeDecision};runtimeImpl=${runtimeImplName};called=${wideRuntimeDecision === 'started'}`
  })

  const filteredHistory = Array.isArray(history)
    ? history.filter((item) => item?.id !== event?.id)
    : []

  const resolvedEventWindow = Array.isArray(eventWindow)
    ? eventWindow
    : buildEventWindow(
        filteredHistory,
        resolvedLimits.rawContextEvents,
        resolvedLimits.rawContextCharsPerEvent
      )

  const warnings = []
  const errors = []
  let regexPacket = null
  let extractorPacket = null

  if (settings.mode === 'heuristic_only' || settings.mode === 'hybrid') {
    try {
      regexPacket = await regexExtractor({
        event
      })
    } catch (error) {
      warnings.push('regex_observe_failed')
      errors.push(error?.message || 'regex_observe_failed')
    }
  }

  if (wideRuntimeDecision === 'started') {
    writeMemoryLiveTrace({
      marker: 'wide_llm_runtime_started',
      eventId: event?.id || null,
      threadId: resolvedThreadId,
      messageId: event?.id || null,
      memoryExtractionMode: settings.mode,
      wideLlmExtractorEnabled: settings.wideLlmExtractorEnabled,
      disablePersistenceWrite: settings.disablePersistenceWrite,
      note: runtimeImplName
    })

    extractorPacket = await runtimeImpl({
      event,
      eventWindow: resolvedEventWindow
    })

    writeMemoryLiveTrace({
      marker: 'wide_llm_runtime_finished',
      eventId: event?.id || null,
      threadId: resolvedThreadId,
      messageId: event?.id || null,
      memoryExtractionMode: settings.mode,
      wideLlmExtractorEnabled: settings.wideLlmExtractorEnabled,
      disablePersistenceWrite: settings.disablePersistenceWrite,
      note: extractorPacket?.service?.debug?.status || extractorPacket?.orchestration?.status || 'finished'
    })

    warnings.push(...safeArray(extractorPacket?.service?.warnings))
    errors.push(...collectRuntimeErrors(extractorPacket))
  } else if (settings.mode === 'heuristic_only') {
    warnings.push('wide_llm_runtime_disabled_for_heuristic_only_mode')
  } else {
    warnings.push('wide_llm_runtime_disabled_by_config')
  }

  const status = extractorPacket
    ? mapRuntimeStatus(extractorPacket)
    : errors.length > 0
      ? 'failed'
      : 'success'
  const traceId = extractorPacket?.traceId || extractorPacket?.orchestration?.persistencePacket?.traceId || null
  const storagePacket = extractorPacket?.persistencePacket || extractorPacket?.orchestration?.persistencePacket || null
  const candidatePool = extractorPacket?.orchestration?.candidatePool || null
  const persistenceSkipped = settings.disablePersistenceWrite === true

  if (persistenceSkipped) {
    warnings.push('persistence_skipped_by_config')
    await logPersistenceSkip({
      traceId,
      eventId: event?.id || null,
      threadId: resolvedThreadId,
      storagePacket,
      warnings,
      errors
    })
  }

  return {
    traceId,
    eventId: event?.id || null,
    threadId: resolvedThreadId,
    status,
    eventWindow: resolvedEventWindow,
    candidatePool,
    storagePacket,
    persistenceSkipped,
    warnings: Array.from(new Set(warnings)),
    errors: Array.from(new Set(errors)),
    extractorPacket,
    regexPacket
  }
}

module.exports = {
  runExtractFilterObservePipeline,
  DEFAULT_PIPELINE_LIMITS
}
