'use strict'

const { writeMemoryDebug } = require('../../debug/memory-debug.service')
const {
  LLM_EXTRACTOR_FLOW_CONFIG
} = require('./config/extractor-passes.config')
const { getRegisteredExtractorPasses } = require('./passes/registry')
const { normalizePassResult } = require('./normalization/normalize-pass-result')
const { mergePassResults } = require('./merge/merge-pass-results')
const { stageCandidatePool } = require('./lifecycle/stage-candidate-pool')
const { triageCandidatePool } = require('./lifecycle/triage-candidate-pool')
const { routeCandidatePool } = require('./lifecycle/route-candidate-pool')
const {
  buildPersistencePacket
} = require('./storage-resolution/build-persistence-packet')
const { runAllExtractorPasses } = require('./shared/run-all-passes')
const { logNormalization } = require('./logging/log-normalization')
const { logMerge } = require('./logging/log-merge')
const { logTriage } = require('./logging/log-triage')
const { logRouting } = require('./logging/log-routing')
const { logPersistence } = require('./logging/log-persistence')
const { writeFailureLog } = require('./logging/write-failure-log')
const { LOG_STAGES } = require('./registries/log-stage.registry')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function uniq(list = []) {
  return Array.from(new Set(safeArray(list).filter(Boolean)))
}

function buildNormalizationStats(candidates = []) {
  const unknownKinds = new Set()
  const kindFallbackPreview = []
  let unstableImportanceCount = 0
  let cleanedTagsCount = 0
  let payloadUnstableCount = 0
  let fallbackKindCount = 0

  for (const candidate of safeArray(candidates)) {
    const flags = safeArray(candidate?.flags)
    const warnings = safeArray(candidate?.normalization?.warnings)
    const changedFields = safeArray(candidate?.normalization?.changedFields)

    if (flags.includes('unknown_candidate_kind')) {
      unknownKinds.add(candidate?.rawKind || candidate?.kind || 'unknown')
    }

    if (flags.includes('kind_fallback_from_source_pass')) {
      fallbackKindCount += 1
      kindFallbackPreview.push({
        candidateId: candidate?.candidateId || candidate?.id || null,
        sourcePass: candidate?.sourcePass || null,
        rawKind: candidate?.rawKind || null,
        fallbackKind: candidate?.kind || null
      })
    }

    if (flags.includes('unknown_candidate_importance')) {
      unstableImportanceCount += 1
    }

    if (
      flags.includes('candidate_tags_empty_after_normalization') ||
      warnings.includes('candidate_tags_deduplicated_or_cleaned') ||
      changedFields.includes('tags')
    ) {
      cleanedTagsCount += 1
    }

    if (
      flags.some((flag) => String(flag).startsWith('payload_')) ||
      changedFields.includes('payload')
    ) {
      payloadUnstableCount += 1
    }
  }

  return {
    unknownKinds: Array.from(unknownKinds),
    fallbackKindCount,
    kindFallbackPreview,
    unstableImportanceCount,
    cleanedTagsCount,
    payloadUnstableCount
  }
}

function resolvePasses(requestedPasses) {
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

async function orchestrateWideLlmExtraction({
  event,
  eventWindow = [],
  context = {},
  passes = null,
  llm = {},
  runtime = {}
}) {
  const startedAt = Date.now()
  const executionPasses = resolvePasses(passes)
  const flowConfig = {
    ...LLM_EXTRACTOR_FLOW_CONFIG,
    ...(runtime?.flowConfig || {})
  }

  const passExecution = await runAllExtractorPasses({
    passes: executionPasses,
    event,
    eventWindow,
    context,
    llm,
    runtime,
    flowConfig
  })

  const normalizeSinglePassResult =
    typeof runtime?.normalizePassResult === 'function'
      ? runtime.normalizePassResult
      : normalizePassResult

  const normalizationSettled = await Promise.allSettled(
    passExecution.successful.map(async (item) => {
      const normalizationStartedAt = Date.now()

      try {
        const normalized = await normalizeSinglePassResult(item)
        const normalizationMeta = normalized?.normalizationMeta || {}
        const normalizationStats = buildNormalizationStats(normalized?.candidates)

        await logNormalization({
          traceId: normalized?.traceId || item?.traceId || runtime?.traceId || null,
          eventId: normalized?.eventId || item?.eventId || event?.id || null,
          threadId: normalized?.threadId || item?.threadId || event?.threadId || null,
          sourcePass: normalized?.sourcePass || item?.sourcePass || item?.extractorKey || null,
          extractorName:
            normalized?.extractorName || item?.extractorName || null,
          status: 'completed',
          durationMs: Date.now() - normalizationStartedAt,
          inputCandidateCount: normalizationMeta.candidateCountBefore || 0,
          outputCandidateCount: normalizationMeta.candidateCountAfter || 0,
          changedFieldsSummary: normalizationMeta.changedFieldsSummary || {},
          unknownKinds: normalizationStats.unknownKinds,
          fallbackKindCount:
            normalizationMeta.fallbackKindCount || normalizationStats.fallbackKindCount || 0,
          kindFallbackPreview:
            normalizationMeta.kindFallbackPreview || normalizationStats.kindFallbackPreview || [],
          unstableImportanceCount:
            normalizationStats.unstableImportanceCount,
          cleanedTagsCount: normalizationStats.cleanedTagsCount,
          payloadUnstableCount: normalizationStats.payloadUnstableCount,
          inputCandidates: safeArray(item?.candidates),
          outputCandidates: safeArray(normalized?.candidates),
          warnings: uniq([
            ...safeArray(item?.warnings),
            ...safeArray(normalizationMeta.warnings)
          ]),
          errors: []
        })

        return normalized
      } catch (error) {
        await logNormalization({
          traceId: item?.traceId || runtime?.traceId || null,
          eventId: item?.eventId || event?.id || null,
          threadId: item?.threadId || event?.threadId || null,
          sourcePass: item?.sourcePass || item?.extractorKey || null,
          extractorName: item?.extractorName || null,
          status: 'failed',
          durationMs: Date.now() - normalizationStartedAt,
          inputCandidateCount: safeArray(item?.candidates).length,
          outputCandidateCount: 0,
          changedFieldsSummary: {},
          unknownKinds: [],
          fallbackKindCount: 0,
          kindFallbackPreview: [],
          unstableImportanceCount: 0,
          cleanedTagsCount: 0,
          payloadUnstableCount: 0,
          inputCandidates: safeArray(item?.candidates),
          outputCandidates: [],
          warnings: safeArray(item?.warnings),
          errors: [error?.message || 'normalization_failed'],
          note: error?.code || 'normalization_failed'
        })

        await writeFailureLog({
          traceId: item?.traceId || runtime?.traceId || null,
          eventId: item?.eventId || event?.id || null,
          threadId: item?.threadId || event?.threadId || null,
          failedStage: LOG_STAGES.NORMALIZATION,
          extractorName: item?.extractorName || null,
          sourcePass: item?.sourcePass || item?.extractorKey || null,
          status: 'failed',
          durationMs: Date.now() - normalizationStartedAt,
          warnings: safeArray(item?.warnings),
          errors: [error?.message || 'normalization_failed'],
          note: error?.code || 'normalization_failed',
          error
        })

        throw error
      }
    })
  )

  const normalizedSuccessful = []
  const normalizationFailed = []

  for (let index = 0; index < normalizationSettled.length; index += 1) {
    const settlement = normalizationSettled[index]
    const sourcePass = passExecution.successful[index]

    if (settlement.status === 'fulfilled') {
      normalizedSuccessful.push(settlement.value)
      continue
    }

    normalizationFailed.push({
      extractorKey: sourcePass?.extractorKey || null,
      extractorName: sourcePass?.extractorName || null,
      role: sourcePass?.role || null,
      error: {
        message: settlement.reason?.message || String(settlement.reason || 'normalization_failed'),
        code: settlement.reason?.code || 'normalization_failed'
      }
    })
  }

  const failedPasses = [...passExecution.failed, ...normalizationFailed]
  const normalizedCandidates = normalizedSuccessful.flatMap((item) =>
    Array.isArray(item.candidates) ? item.candidates : []
  )
  const mergedPool = mergePassResults({
    traceId: runtime?.traceId || normalizedSuccessful?.[0]?.traceId || null,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    passResults: normalizedSuccessful,
    configuredPasses: executionPasses,
    failedPasses
  })
  const mergedCandidates = safeArray(mergedPool?.candidates)
  const stagedPool = stageCandidatePool(mergedPool)
  const triagedPool = triageCandidatePool(stagedPool)
  const routedPool = routeCandidatePool(triagedPool)
  const persistencePacket = buildPersistencePacket({
    ...routedPool,
    rawEvent: event || null
  })
  const candidates = safeArray(routedPool?.candidates)
  const mergeMeta = mergedPool?.mergeMeta || {}
  const triageMeta = routedPool?.lifecycle?.triage || {}
  const routingMeta = routedPool?.lifecycle?.routing || {}
  const resolutionMeta = persistencePacket?.resolutionMeta || {}

  const warnings = Array.from(new Set([
    ...normalizedSuccessful.flatMap((item) =>
      Array.isArray(item.warnings) ? item.warnings : []
    ),
    ...safeArray(mergeMeta?.warnings),
    ...failedPasses.map(
      (item) => `pass_failed:${item.extractorKey || 'unknown'}:${item.error.message}`
    )
  ]))

  const result = {
    status:
      failedPasses.length === 0
        ? 'ok'
        : normalizedSuccessful.length > 0
          ? 'partial'
          : 'failed',
    strategy: flowConfig.strategy,
    candidates,
    candidatePool: routedPool,
    persistencePacket,
    warnings,
    passes: {
      configured: executionPasses.length,
      successful: normalizedSuccessful,
      failed: failedPasses,
      partialFailure: failedPasses.length > 0
    },
    nextStage: {
      normalization: {
        status: normalizationFailed.length === 0 ? 'completed' : normalizedSuccessful.length > 0 ? 'partial' : 'failed',
        candidates: normalizedCandidates,
        passResults: normalizedSuccessful,
        failedPasses: normalizationFailed
      },
      merge: {
        status: 'completed',
        candidatePool: mergedPool,
        candidates: mergedCandidates,
        mergeMeta
      },
      lifecycle: {
        status: 'completed',
        staged: stagedPool,
        triaged: triagedPool,
        routed: routedPool
      },
      storageResolution: {
        status: 'completed',
        persistencePacket
      },
      logging: {
        status: 'ready',
        successfulPasses: normalizedSuccessful,
        failedPasses
      },
      failurePolicy: {
        status: 'ready',
        partialFailure: failedPasses.length > 0,
        failedPasses
      }
    },
    durationMs: Date.now() - startedAt
  }

  await logMerge({
    traceId: runtime?.traceId || normalizedSuccessful?.[0]?.traceId || null,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    status: 'completed',
    durationMs: null,
    inputPassCount: normalizedSuccessful.length,
    missingPasses: safeArray(mergeMeta?.missingPasses),
    totalInputCandidates: mergeMeta?.totalInputCandidates || 0,
    totalOutputCandidates: mergeMeta?.totalOutputCandidates || 0,
    duplicateGroups: mergeMeta?.duplicateGroups || 0,
    overlapGroups: mergeMeta?.overlapGroups || 0,
    conflictGroups: mergeMeta?.conflictGroups || 0,
    duplicateGroupPreview: safeArray(mergeMeta?.duplicateGroupPreview),
    overlapGroupPreview: safeArray(mergeMeta?.overlapGroupPreview),
    conflictGroupPreview: safeArray(mergeMeta?.conflictGroupPreview),
    mergeActionsPreview: [
      `output_candidates:${mergeMeta?.totalOutputCandidates || 0}`,
      `duplicate_groups:${mergeMeta?.duplicateGroups || 0}`,
      `overlap_groups:${mergeMeta?.overlapGroups || 0}`,
      `conflict_groups:${mergeMeta?.conflictGroups || 0}`,
      ...safeArray(mergeMeta?.mergeActionsPreview)
    ],
    warnings: safeArray(mergeMeta?.warnings),
    errors: []
  })

  await logTriage({
    traceId: routedPool?.traceId || runtime?.traceId || null,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    status: 'completed',
    durationMs: null,
    warnings: [],
    errors: [],
    counts: {
      triagedCandidateCount: triageMeta?.triagedCandidateCount || 0,
      skippedCandidateCount: triageMeta?.skippedCandidateCount || 0,
      targetKinds: Object.keys(triageMeta?.targetCounts || {}).length
    },
    note: null,
    decisions: safeArray(triageMeta?.decisions).slice(0, 20),
    routedCandidateCount: routingMeta?.routedCandidateCount || 0,
    deferredCandidateCount:
      (triageMeta?.targetCounts || {})['reflection_queue'] || 0
  })

  await logRouting({
    traceId: routedPool?.traceId || runtime?.traceId || null,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    status: 'completed',
    durationMs: null,
    warnings: [],
    errors: [],
    counts: {
      routedCandidateCount: routingMeta?.routedCandidateCount || 0,
      skippedCandidateCount: routingMeta?.skippedCandidateCount || 0,
      activeTargets: Object.keys(routingMeta?.targetCounts || {}).length
    },
    note: null,
    targets: Object.entries(routingMeta?.targetCounts || {}).map(
      ([target, count]) => ({ target, count })
    ),
    skippedTargets: Object.entries(routingMeta?.targetCounts || {})
      .filter(([, count]) => !count)
      .map(([target]) => target)
  })

  await logPersistence({
    traceId: persistencePacket?.traceId || runtime?.traceId || null,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    status: 'ready',
    durationMs: null,
    warnings: safeArray(resolutionMeta?.warnings),
    errors: [],
    counts: {
      nodeCount: resolutionMeta?.nodeCount || 0,
      factCount: resolutionMeta?.factCount || 0,
      episodeCount: resolutionMeta?.episodeCount || 0,
      edgeCount: resolutionMeta?.edgeCount || 0,
      derivedCount: resolutionMeta?.derivedCount || 0,
      reflectionCount: resolutionMeta?.reflectionCount || 0
    },
    note: 'storage_resolution_packet_ready',
    storageTarget: 'persistence_packet',
    storedCandidateCount: null,
    rejectedCandidateCount: null
  })

  writeMemoryDebug({
    layer: 'llm-extractor-orchestrator',
    timestamp: new Date().toISOString(),
    threadId: event?.threadId || null,
    messageId: event?.id || null,
    eventId: event?.id || null,
    sourceEventId: event?.id || null,
    input: {
      passes: executionPasses.map((pass) => ({
        extractorKey: pass.extractorKey,
        extractorName: pass.extractorName
      })),
      eventWindowSize: Array.isArray(eventWindow) ? eventWindow.length : 0
    },
    output: {
      status: result.status,
      candidateCount: candidates.length,
      successfulPasses: normalizedSuccessful.map((item) => item.extractorKey),
      failedPasses: failedPasses.map((item) => item.extractorKey)
    },
    meta: {
      strategy: result.strategy,
      durationMs: result.durationMs,
      partialFailure: result.passes.partialFailure
    },
    errors: failedPasses.map((item) => item.error.message)
  })

  return result
}

module.exports = {
  orchestrateWideLlmExtraction
}
