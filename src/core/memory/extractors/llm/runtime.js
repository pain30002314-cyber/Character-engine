'use strict'

const env = require('../../../../config/env')
const { buildPrompt } = require('./prompt')
const { normalizeMemoryCandidatesPacket } = require('./normalize')
const { postprocessLlmCandidates } = require('./postprocess')
const { appendLlmDebugLog } = require('./debug/llm.debug')
const { generateRawCompletion } = require('../../../../services/llm.service')

const EXTRACTOR_VERSION = '2.0.0'
const PROMPT_VERSION = 'llm_memory_candidates_v1'
const STRATEGY = 'llm_memory_candidates_v1'

function safeArray(value) {
  return Array.isArray(value) ? value : []
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

function buildResponseMeta(response, fallbackModel) {
  if (!response) return null

  return {
    id: response?.id || null,
    model: response?.model || fallbackModel || null,
    usage: response?.usage || null,
    finishReason: response?.choices?.[0]?.finish_reason || null
  }
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

function buildBaseResult({ event, eventWindow }) {
  return {
    version: 1,
    strategy: STRATEGY,
    event: buildFallbackEvent(event),
    context: {
      eventWindow: buildWindowPreview(eventWindow),
      identity: {
        coreUserRef: 'core_user:main',
        coreCharacterRef: 'core_character:active',
        userDisplayName: null,
        characterDisplayName: null
      }
    },
    candidates: [],
    temporal: {
      messageTime: event?.timestamp || null,
      anchors: []
    },
    meta: {
      source: 'llm',
      usedModel: env.memoryModel,
      promptVersion: PROMPT_VERSION,
      extractorVersion: EXTRACTOR_VERSION,
      durationMs: 0
    },
    debug: {
      rawModelContent: null,
      parsed: null,
      warnings: []
    }
  }
}

function finalizeResult({
  normalizedPacket,
  event,
  eventWindow,
  rawModelContent,
  parsed,
  response,
  durationMs,
  error,
  userPrompt
}) {
  const fallback = buildBaseResult({ event, eventWindow })

  const result =
    normalizedPacket && typeof normalizedPacket === 'object'
      ? {
          ...fallback,
          ...normalizedPacket,
          event: {
            ...fallback.event,
            ...(normalizedPacket.event || {})
          },
          context: {
            eventWindow:
              safeArray(normalizedPacket?.context?.eventWindow).length > 0
                ? normalizedPacket.context.eventWindow
                : fallback.context.eventWindow,
            identity: {
              ...fallback.context.identity,
              ...(normalizedPacket?.context?.identity || {})
            }
          },
          temporal: {
            ...fallback.temporal,
            ...(normalizedPacket?.temporal || {})
          },
          meta: {
            ...fallback.meta,
            ...(normalizedPacket?.meta || {})
          },
          debug: {
            ...fallback.debug,
            ...(normalizedPacket?.debug || {})
          }
        }
      : fallback

  result.version = 1
  result.strategy = STRATEGY

  result.meta = {
    ...result.meta,
    source: 'llm',
    usedModel: response?.model || env.memoryModel || null,
    promptVersion: PROMPT_VERSION,
    extractorVersion: EXTRACTOR_VERSION,
    durationMs
  }

  result.debug = {
    ...result.debug,
    rawModelContent,
    parsed: parsed || null,
    warnings: safeArray(result?.debug?.warnings)
  }

  if (error) {
    result.debug.warnings.push(error)
  }

  result.service = {
    extractorVersion: EXTRACTOR_VERSION,
    processedAt: new Date().toISOString(),
    durationMs,
    stats: {
      eventWindowSize: safeArray(eventWindow).length,
      candidates: safeArray(result.candidates).length
    },
    warnings: result.debug.warnings,
    debug: {
      usedModel: response?.model || env.memoryModel,
      promptVersion: PROMPT_VERSION,
      strategy: STRATEGY,
      response: buildResponseMeta(response, env.memoryModel),
      userPrompt
    }
  }

  return result
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

async function runLlmExtractor({ event, eventWindow = [] }) {
  const startedAt = Date.now()

  const userPrompt = buildPrompt({
    event,
    eventWindow,
    identity: {
      coreUserRef: 'core_user:main',
      coreCharacterRef: 'core_character:active',
      userDisplayName: null,
      characterDisplayName: null
    }
  })

  let rawModelContent = null
  let parsed = null
  let normalizedPacket = null
  let error = null
  let response = null

  try {
    response = await generateRawCompletion({
      systemPrompt: [
        'Ты главный semantic memory extractor для memory pipeline.',
        'Верни только JSON-пакет формата llm_memory_candidates_v1.',
        'Все human-readable текстовые поля памяти пиши на русском.',
        'Системные идентификаторы, enum-поля и schema keys оставляй на английском.',
        'Если memory-relevant сигналов нет, верни пустой массив candidates.'
      ].join(' '),
      userPrompt,
      temperature: 0,
      max_tokens: 8000,
      model: env.memoryModel,
      title: 'Hu Tao LLM Memory Candidates Extractor'
    })

    rawModelContent = response?.choices?.[0]?.message?.content || ''
    parsed = JSON.parse(rawModelContent)

    normalizedPacket = normalizeMemoryCandidatesPacket(parsed, {
      event: buildFallbackEvent(event),
      meta: {
        usedModel: response?.model || env.memoryModel,
        promptVersion: PROMPT_VERSION,
        extractorVersion: EXTRACTOR_VERSION
      }
    })

    const resolvedModel = response?.model || env.memoryModel || null

    normalizedPacket.candidates = Array.isArray(normalizedPacket.candidates)
      ? normalizedPacket.candidates.map((c) => ({
          ...c,
          source: {
            ...(c.source || {}),
            model: resolvedModel
          }
        }))
      : []

    normalizedPacket = postprocessLlmCandidates(normalizedPacket)
    
  } catch (err) {
    error = err?.message || 'unknown_error'
  }

  const durationMs = Date.now() - startedAt

  const result = finalizeResult({
    normalizedPacket,
    event,
    eventWindow,
    rawModelContent,
    parsed,
    response,
    durationMs,
    error,
    userPrompt
  })

  await appendLlmDebugLog({
    extractor: 'llm',
    timestamp: new Date().toISOString(),
    eventId: event?.id || null,
    threadId: event?.threadId || null,
    role: event?.role || null,
    sourceText: event?.text || '',
    event: result.event,
    eventWindow: result.context?.eventWindow || [],
    prompt: {
      usedModel: result.meta?.usedModel || env.memoryModel,
      promptVersion: PROMPT_VERSION,
      strategy: STRATEGY,
      userPrompt
    },
    response: buildResponseMeta(response, env.memoryModel),
    output: {
      rawModelContent,
      parsed,
      candidates: result.candidates
    },
    stats: result.service?.stats || {},
    warnings: result.debug?.warnings || []
  })

  return result
}

module.exports = {
  runLlmExtractor
}
