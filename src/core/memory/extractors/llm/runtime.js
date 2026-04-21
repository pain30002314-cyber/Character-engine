'use strict'

const env = require('../../../../config/env')
const { buildPrompt } = require('./prompt')
const { normalizeMemoryCandidatesPacket } = require('./normalize')
const { postprocessLlmCandidates } = require('./postprocess')
const {
  needsSemanticTagsPatch,
  runSemanticTagsPatch,
  applySemanticTagsPatch
} = require('./tags.runtime')
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
        'semantic.tags не заполняй: оставляй пустым массивом.',
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
      ? normalizedPacket.candidates.map((candidate) => ({
          ...candidate,
          semantic: {
            ...(candidate?.semantic || {}),
            tags: []
          },
          source: {
            ...(candidate?.source || {}),
            model: resolvedModel
          }
        }))
      : []

    normalizedPacket = postprocessLlmCandidates(normalizedPacket, {
      finalizeTags: false
    })

    if (needsSemanticTagsPatch(normalizedPacket)) {
      const tagPatchResult = await runSemanticTagsPatch({
        event,
        candidates: normalizedPacket.candidates
      })

      normalizedPacket = applySemanticTagsPatch(normalizedPacket, tagPatchResult)
    }

    normalizedPacket = postprocessLlmCandidates(normalizedPacket, {
      finalizeTags: true
    })
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

            console.log('PATCH_CHECK', {
            candidates: normalizedPacket.candidates.length,
            shouldPatch: needsSemanticTagsPatch(normalizedPacket)
          })

          if (needsSemanticTagsPatch(normalizedPacket)) {
            console.log(
              'PATCH_BEFORE_TAGS',
              normalizedPacket.candidates.map((c) => ({
                id: c.id,
                tags: c?.semantic?.tags || []
              }))
            )

            const tagPatchResult = await runSemanticTagsPatch({
              event,
              candidates: normalizedPacket.candidates
            })

            console.log('PATCH_RESULT', JSON.stringify(tagPatchResult, null, 2))

            normalizedPacket = applySemanticTagsPatch(normalizedPacket, tagPatchResult)

            console.log(
              'PATCH_AFTER_APPLY',
              normalizedPacket.candidates.map((c) => ({
                id: c.id,
                tags: c?.semantic?.tags || []
              }))
            )
          }

          normalizedPacket = postprocessLlmCandidates(normalizedPacket, {
            finalizeTags: true
          })

          console.log(
            'PATCH_AFTER_FINAL_POSTPROCESS',
            normalizedPacket.candidates.map((c) => ({
              id: c.id,
              tags: c?.semantic?.tags || [],
              flags: c?.flags || []
            }))
          )

  return result
}

module.exports = {
  runLlmExtractor
}