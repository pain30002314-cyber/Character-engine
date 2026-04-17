'use strict'

const env = require('../../../../config/env')
const { generateRawCompletion } = require('../../../../services/llm.service')
const { buildFilterPrompt } = require('./prompt')
const {
  FILTER_VERSION,
  FILTER_STRATEGY
} = require('./constants')
const {
  parseFilterEvaluatorResponse,
  enrichCandidatesWithFilterEvaluations,
  buildBatchSummary
} = require('./normalize')
const { appendFilterDebugLog } = require('./debug/llm-filter.debug')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function buildResponseMeta(response, fallbackModel) {
  if (!response) return null

  return {
    id: response?.id || null,
    model: response?.model || fallbackModel || null,
    usage: response?.usage || null,
    finishReason: response?.choices?.[0]?.finish_reason || null
  }
}

function getExtractorVersion(packet) {
  return (
    packet?.meta?.extractorVersion ||
    packet?.service?.extractorVersion ||
    null
  )
}

function buildPromptInput(packet) {
  return {
    thread_id: packet?.event?.threadId || null,
    message_id: packet?.event?.id || null,
    event_id: packet?.event?.id || null,
    source_text: packet?.event?.text || '',
    extractor_version: getExtractorVersion(packet),
    extractor_strategy: packet?.strategy || null,
    candidates: safeArray(packet?.candidates).map((candidate) => ({
      id: candidate?.id || null,
      kind: candidate?.kind || null,
      text: candidate?.text || '',
      normalizedText: candidate?.normalizedText || '',
      summary: candidate?.summary || null,
      confidence: candidate?.confidence ?? null,
      semantic: candidate?.semantic || {},
      references: candidate?.references || {},
      evidence: candidate?.evidence || {},
      temporal: candidate?.temporal || {},
      memory: candidate?.memory || {},
      flags: safeArray(candidate?.flags)
    }))
  }
}

function buildBaseResult(packet, durationMs = 0, response = null, warnings = []) {
  return {
    thread_id: packet?.event?.threadId || null,
    message_id: packet?.event?.id || null,
    event_id: packet?.event?.id || null,
    source_text: packet?.event?.text || '',
    extractor_version: getExtractorVersion(packet),
    filter_version: FILTER_VERSION,
    candidates: [],
    batch_summary: buildBatchSummary([]),
    meta: {
      source: FILTER_STRATEGY,
      used_model: response?.model || env.memoryModel || null,
      duration_ms: durationMs,
      warnings
    }
  }
}

async function evaluateLlmCandidateBatchV1({ extractorPacket }) {
  const startedAt = Date.now()
  const warnings = []
  const promptInput = buildPromptInput(extractorPacket)
  const userPrompt = buildFilterPrompt({ input: promptInput })
  const systemPrompt = [
    'You are a strict JSON-only candidate evaluator for memory-ingestion triage.',
    'You only evaluate extracted candidates.',
    'You do not write memory, resolve conflicts, link entities, or reconcile contradictions.',
    'Return only JSON matching the requested schema.'
  ].join(' ')

  let response = null
  let rawModelContent = null
  let parsed = null
  let parseError = null
  let finalCandidates = []

  if (!safeArray(extractorPacket?.candidates).length) {
    const durationMs = Date.now() - startedAt
    const result = buildBaseResult(
      extractorPacket,
      durationMs,
      null,
      ['no_candidates']
    )

    await appendFilterDebugLog({
      layer: FILTER_STRATEGY,
      timestamp: new Date().toISOString(),
      threadId: result.thread_id,
      messageId: result.message_id,
      eventId: result.event_id,
      sourceText: result.source_text,
      extractorVersion: result.extractor_version,
      input: {
        promptInput,
        extractorCandidates: []
      },
      prompt: {
        systemPrompt,
        userPrompt,
        usedModel: env.memoryModel || null
      },
      response: null,
      parsedResponse: null,
      output: result,
      errors: ['no_candidates']
    })

    return result
  }

  try {
    response = await generateRawCompletion({
      systemPrompt,
      userPrompt,
      temperature: 0,
      max_tokens: 4000,
      model: env.memoryModel,
      title: 'Hu Tao LLM Candidate Filter Evaluator'
    })

    rawModelContent = response?.choices?.[0]?.message?.content || ''

    const parsedResponse = parseFilterEvaluatorResponse(rawModelContent)
    parsed = parsedResponse.parsed
    parseError = parsedResponse.parseError

    if (parseError) {
      warnings.push(`parse_error:${parseError}`)
    }

    finalCandidates = enrichCandidatesWithFilterEvaluations(
      extractorPacket?.candidates,
      parsedResponse.evaluations,
      {
        parseError
      }
    )
  } catch (error) {
    warnings.push(error?.message || 'unknown_error')
    parseError = error?.message || 'llm_request_failed'
    finalCandidates = enrichCandidatesWithFilterEvaluations(
      extractorPacket?.candidates,
      [],
      {
        parseError
      }
    )
  }

  const durationMs = Date.now() - startedAt
  const result = buildBaseResult(extractorPacket, durationMs, response, warnings)
  result.candidates = finalCandidates
  result.batch_summary = buildBatchSummary(finalCandidates)

  await appendFilterDebugLog({
    layer: FILTER_STRATEGY,
    timestamp: new Date().toISOString(),
    threadId: result.thread_id,
    messageId: result.message_id,
    eventId: result.event_id,
    sourceText: result.source_text,
    extractorVersion: result.extractor_version,
    input: {
      extractorPacketMeta: extractorPacket?.meta || null,
      promptInput,
      extractorCandidates: extractorPacket?.candidates || []
    },
    prompt: {
      systemPrompt,
      userPrompt,
      usedModel: response?.model || env.memoryModel || null
    },
    response: {
      meta: buildResponseMeta(response, env.memoryModel),
      rawModelContent
    },
    parsedResponse: parsed,
    output: {
      candidates: result.candidates,
      batchSummary: result.batch_summary,
      meta: result.meta
    },
    errors: warnings
  })

  return result
}

module.exports = {
  evaluateLlmCandidateBatchV1
}
