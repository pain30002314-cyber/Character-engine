'use strict'

const { writeMemoryDebug } = require('../../../debug/memory-debug.service')
const { buildBaseEventPacket } = require('./build-base-event-packet')
const { buildPrompt } = require('./build-prompt')
const { callLlm } = require('./call-llm')
const { parseJson } = require('./parse-json')
const { repairJson } = require('./repair-json')
const { validateLlmOutput } = require('./validate-llm-output')
const { mapLlmCandidates } = require('./map-llm-candidates')
const { enrichWithSystemFields } = require('./enrich-with-system-fields')
const { createTraceId } = require('../utils/ids')
const { buildTextPreview, buildJsonPreview } = require('../utils/preview')
const { logPassRun, buildCandidatePreview } = require('../logging/log-pass-run')
const { classifyFailure } = require('../failure/classify-failure')
const { buildPartialPassResult } = require('../failure/build-partial-pass-result')
const { handlePassFailure } = require('../failure/handle-pass-failure')
const { MAX_PASS_RETRIES } = require('../failure/should-retry')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function toErrorMessage(error) {
  if (!error) return 'unknown_pass_error'
  return error.message || String(error)
}

function summarizeEvent(event) {
  if (!event) return null

  return {
    id: event.id || null,
    threadId: event.threadId || null,
    role: event.role || null,
    timestamp: event.timestamp || null,
    text: event.text || ''
  }
}

function buildPassFailureError(code, message, details = {}) {
  const error = new Error(message || code)
  error.code = code
  error.details = details
  return error
}

function mergeWarnings(...parts) {
  return Array.from(
    new Set(
      parts.flatMap((items) => (Array.isArray(items) ? items.filter(Boolean) : []))
    )
  )
}

function resolvePassStatus({ callWarnings, repairedJson, validation }) {
  if (!validation?.ok) {
    return 'failed'
  }

  if (
    safeArray(callWarnings).length > 0 ||
    repairedJson ||
    safeArray(validation?.droppedCandidates).length > 0 ||
    safeArray(validation?.warnings).length > 0
  ) {
    return 'partial'
  }

  return 'success'
}

function buildSuccessfulPassResult({
  pass,
  event,
  eventWindow = [],
  traceId = null,
  status = 'success',
  rawResponseText = '',
  repairedJson = null,
  candidates = [],
  warnings = [],
  errors = [],
  durationMs = 0,
  baseEventPacket = null,
  promptPacket = null,
  llmCall = null,
  parsedResponse = null,
  validation = null,
  retryCount = 0,
  failure = null
}) {
  return {
    traceId,
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    sourcePass: pass.extractorKey,
    extractorKey: pass.extractorKey,
    extractorName: pass.extractorName,
    role: pass.role || null,
    status,
    rawResponseText,
    repairedJson,
    candidates,
    warnings,
    errors,
    durationMs,
    baseEventPacket,
    promptPacket,
    llmCall,
    parsedResponse,
    validation,
    retryCount,
    failure,
    stats: {
      eventWindowSize: safeArray(eventWindow).length,
      parsedCandidateCount: validation?.stats?.parsedCandidateCount || 0,
      validCandidateCount: validation?.stats?.validCandidateCount || 0,
      droppedCandidateCount: validation?.stats?.droppedCandidateCount || 0,
      candidateCount: candidates.length
    }
  }
}

async function logResolvedPassResult(result) {
  await logPassRun({
    traceId: result.traceId,
    eventId: result.eventId,
    threadId: result.threadId,
    extractorName: result.extractorName,
    sourcePass: result.sourcePass,
    status: result.status,
    durationMs: result.durationMs,
    model: result.llmCall?.model || null,
    promptLanguage:
      result.promptPacket?.promptLanguage ||
      result.baseEventPacket?.promptLanguageCode ||
      null,
    retryCount: Number(result.retryCount || 0),
    promptPreview: result.promptPacket?.prompt || null,
    rawResponseText: result.rawResponseText,
    repairedJson: result.repairedJson,
    parsedCandidateCount: result.stats?.parsedCandidateCount || 0,
    validCandidateCount: result.stats?.validCandidateCount || 0,
    droppedCandidateCount: result.stats?.droppedCandidateCount || 0,
    candidatePreview: buildCandidatePreview(result.candidates),
    warnings: result.warnings,
    errors: result.errors,
    counts: {
      candidateCount: safeArray(result.candidates).length
    },
    note: result.failure?.type || null
  })
}

async function runSingleExtractorPass({
  pass,
  event,
  eventWindow = [],
  context = {},
  llm = {},
  runtime = {},
  flowConfig = {}
}) {
  if (!pass?.extractorKey) {
    throw new Error('extractor_pass_key_is_required')
  }

  const startedAt = Date.now()
  const buildPromptPacket = llm?.buildPromptPacket
  const customCallModel = llm?.callModel
  const customParseModelResponse = llm?.parseModelResponse
  const customRepairJson = llm?.repairJson
  const customValidateModelOutput = llm?.validateModelOutput
  const customMapCandidates = llm?.mapCandidates
  const customEnrichCandidates = llm?.enrichCandidates
  const traceId = runtime?.traceId || createTraceId('llm_pass')
  const maxRetries =
    Number.isFinite(runtime?.failurePolicy?.maxRetries)
      ? Number(runtime.failurePolicy.maxRetries)
      : MAX_PASS_RETRIES

  let baseEventPacket = null
  let promptPacket = null
  try {
    baseEventPacket = buildBaseEventPacket({
      pass,
      event,
      eventWindow,
      context
    })

    if (typeof buildPromptPacket === 'function') {
      promptPacket = await buildPromptPacket({
        pass,
        event,
        eventWindow,
        context,
        runtime,
        flowConfig,
        baseEventPacket
      })
    } else {
      promptPacket = {
        extractorKey: pass.extractorKey,
        extractorName: pass.extractorName,
        promptVersion: baseEventPacket.promptVersion,
        promptLanguage: baseEventPacket.promptLanguageCode,
        baseEventPacket,
        prompt: buildPrompt(baseEventPacket, pass.extractorKey)
      }
    }

    if (!promptPacket?.prompt) {
      promptPacket = {
        ...(promptPacket || {}),
        extractorKey: pass.extractorKey,
        extractorName: pass.extractorName,
        promptVersion: baseEventPacket.promptVersion,
        promptLanguage: baseEventPacket.promptLanguageCode,
        baseEventPacket,
        prompt: buildPrompt(baseEventPacket, pass.extractorKey)
      }
    }
  } catch (error) {
    const handledFailure = await handlePassFailure({
      pass,
      event,
      traceId,
      error,
      baseEventPacket,
      promptPacket,
      durationMs: Date.now() - startedAt,
      retryCount: 0,
      maxRetries,
      eventWindowSize: safeArray(eventWindow).length,
      warnings: [],
      errors: [toErrorMessage(error)]
    })

    return handledFailure.result
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let llmCall = null
    let rawResponseText = ''
    let parsedResponse = null
    let repairedJson = null
    let initialParse = null
    let repairResult = null
    let validation = null

    try {
      llmCall = customCallModel
        ? await customCallModel({
            pass,
            event,
            eventWindow,
            context,
            promptPacket,
            runtime,
            flowConfig
          })
        : await callLlm({
            pass,
            event,
            eventWindow,
            context,
            promptPacket,
            runtime,
            flowConfig
          })

      rawResponseText = String(
        llmCall?.rawResponseText ||
          llmCall?.response?.choices?.[0]?.message?.content ||
          ''
      ).trim()

      initialParse = customParseModelResponse
        ? await customParseModelResponse({
            pass,
            rawResponse: llmCall,
            rawResponseText,
            event,
            runtime,
            flowConfig
          })
        : await parseJson(rawResponseText)

      let parsedValue = initialParse?.ok ? initialParse.value : null
      let parseWarnings = safeArray(initialParse?.warnings)

      if (!parsedValue) {
        repairResult = customRepairJson
          ? await customRepairJson({
              pass,
              event,
              runtime,
              flowConfig,
              llmCall,
              rawResponseText,
              initialParse
            })
          : await repairJson(rawResponseText)

        if (!repairResult?.ok) {
          throw buildPassFailureError(
            'llm_output_parse_failed',
            'Failed to parse and repair LLM JSON output',
            {
              traceId,
              rawResponseText,
              parseError: initialParse?.error || null,
              repairError: repairResult?.error || null,
              warnings: mergeWarnings(initialParse?.warnings, repairResult?.warnings)
            }
          )
        }

        parsedValue = repairResult.value
        repairedJson = repairResult.repairedText || null
        parseWarnings = mergeWarnings(parseWarnings, repairResult?.warnings)
      }

      parsedResponse = parsedValue

      validation = customValidateModelOutput
        ? await customValidateModelOutput({
            parsedValue,
            pass,
            event,
            runtime,
            flowConfig,
            llmCall
          })
        : await validateLlmOutput(parsedValue)

      if (!validation?.ok) {
        throw buildPassFailureError(
          'llm_output_validation_failed',
          'LLM output failed validation',
          {
            traceId,
            rawResponseText,
            repairedJson,
            parsedResponse: parsedValue,
            warnings: mergeWarnings(parseWarnings, validation?.warnings),
            errors: safeArray(validation?.errors)
          }
        )
      }

      const mappedCandidates = customMapCandidates
        ? await customMapCandidates({
            pass,
            event,
            eventWindow,
            context,
            runtime,
            flowConfig,
            llmCall,
            promptPacket,
            candidates: validation.validCandidates
          })
        : await mapLlmCandidates(validation.validCandidates)

      const enriched = customEnrichCandidates
        ? await customEnrichCandidates({
            candidates: mappedCandidates,
            pass,
            event,
            eventWindow,
            context,
            runtime,
            flowConfig,
            llmCall,
            promptPacket,
            traceId
          })
        : await enrichWithSystemFields({
            candidates: mappedCandidates,
            pass,
            event,
            eventWindow,
            context,
            runtime,
            flowConfig,
            llmCall,
            promptPacket,
            traceId
          })

      const candidates = safeArray(enriched?.candidates)
      const warnings = mergeWarnings(
        llmCall?.warnings,
        parseWarnings,
        validation?.warnings
      )
      const errors = safeArray(validation?.errors)
      const classification = classifyFailure({
        validation,
        initialParse,
        repairResult,
        warnings,
        errors
      })
      const status = resolvePassStatus({
        callWarnings: llmCall?.warnings,
        repairedJson,
        validation
      })

      const result =
        classification.type === 'partial_success'
          ? buildPartialPassResult({
              pass,
              event,
              traceId: enriched?.traceId || traceId,
              candidates,
              llmCall,
              rawResponseText,
              repairedJson,
              parsedResponse,
              validation,
              baseEventPacket,
              promptPacket,
              durationMs: Date.now() - startedAt,
              retryCount: attempt,
              eventWindowSize: safeArray(eventWindow).length,
              warnings,
              errors,
              failureType: classification.type
            })
          : buildSuccessfulPassResult({
              pass,
              event,
              eventWindow,
              traceId: enriched?.traceId || traceId,
              status,
              rawResponseText,
              repairedJson,
              candidates,
              warnings,
              errors,
              durationMs: Date.now() - startedAt,
              baseEventPacket,
              promptPacket,
              llmCall,
              parsedResponse,
              validation,
              retryCount: attempt,
              failure: classification.type === 'empty_result' ? classification : null
            })

      writeMemoryDebug({
        layer: 'llm-extractor-pass',
        timestamp: new Date().toISOString(),
        threadId: event?.threadId || null,
        messageId: event?.id || null,
        eventId: event?.id || null,
        sourceEventId: event?.id || null,
        input: {
          pass: {
            extractorKey: pass.extractorKey,
            extractorName: pass.extractorName,
            role: pass.role || null
          },
          event: summarizeEvent(event),
          eventWindowSize: safeArray(eventWindow).length,
          promptVersion: promptPacket?.promptVersion || null,
          traceId: result.traceId,
          retryCount: attempt
        },
        output: {
          status: result.status,
          candidateCount: result.candidates.length,
          warnings: result.warnings,
          errors: result.errors,
          rawResponsePreview: buildTextPreview(result.rawResponseText, 360),
          repairedJsonPreview: buildTextPreview(result.repairedJson, 360),
          parsedPreview: buildJsonPreview(result.parsedResponse, 360)
        },
        meta: {
          durationMs: result.durationMs,
          candidateCount: candidates.length,
          parsedCandidateCount: result.stats.parsedCandidateCount,
          droppedCandidateCount: result.stats.droppedCandidateCount,
          model: result.llmCall?.model || null
        },
        errors: result.errors
      })

      await logResolvedPassResult(result)

      return result
    } catch (error) {
      const durationMs = Date.now() - startedAt
      const errorMessages = [
        toErrorMessage(error),
        ...safeArray(error?.details?.errors)
      ]
      const failureWarnings = mergeWarnings(
        llmCall?.warnings,
        error?.details?.warnings
      )

      writeMemoryDebug({
        layer: 'llm-extractor-pass',
        timestamp: new Date().toISOString(),
        threadId: event?.threadId || null,
        messageId: event?.id || null,
        eventId: event?.id || null,
        sourceEventId: event?.id || null,
        input: {
          pass: {
            extractorKey: pass.extractorKey,
            extractorName: pass.extractorName,
            role: pass.role || null
          },
          event: summarizeEvent(event),
          eventWindowSize: safeArray(eventWindow).length,
          promptVersion: promptPacket?.promptVersion || baseEventPacket?.promptVersion || null,
          traceId,
          retryCount: attempt
        },
        output: {
          rawResponsePreview: buildTextPreview(rawResponseText, 360),
          repairedJsonPreview: buildTextPreview(repairedJson, 360),
          errorDetailsPreview: buildJsonPreview(error?.details || null, 360)
        },
        meta: {
          durationMs,
          model: llmCall?.model || null
        },
        errors: errorMessages
      })

      const handledFailure = await handlePassFailure({
        pass,
        event,
        traceId,
        error,
        llmCall,
        rawResponseText,
        repairedJson,
        parsedResponse,
        validation,
        initialParse,
        repairResult,
        baseEventPacket,
        promptPacket,
        durationMs,
        retryCount: attempt,
        maxRetries,
        eventWindowSize: safeArray(eventWindow).length,
        warnings: failureWarnings,
        errors: errorMessages
      })

      if (handledFailure.action === 'retry') {
        continue
      }

      return handledFailure.result
    }
  }

  const handledFailure = await handlePassFailure({
    pass,
    event,
    traceId,
    error: new Error('extractor_pass_retry_exhausted'),
    baseEventPacket,
    promptPacket,
    durationMs: Date.now() - startedAt,
    retryCount: maxRetries,
    maxRetries,
    eventWindowSize: safeArray(eventWindow).length,
    warnings: [],
    errors: ['extractor_pass_retry_exhausted']
  })

  return handledFailure.result
}

module.exports = {
  runSingleExtractorPass
}
