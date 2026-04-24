'use strict'

const { getDurationMs } = require('../utils/time')
const { buildTextPreview } = require('../utils/preview')

const DEFAULT_SYSTEM_PROMPT = [
  'Ты извлекаешь сигналы памяти из сообщения.',
  'Верни только JSON-объект с массивом candidates.',
  'Не добавляй пояснения вне JSON.'
].join(' ')

const DEFAULT_OPENROUTER_TITLE = 'Character-engine-memory-wide-extractor'
const HEADER_VALUE_MAX_LENGTH = 120

function sanitizeHeaderValue(value, fallback = DEFAULT_OPENROUTER_TITLE) {
  const source = String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim()

  if (!source) {
    return fallback
  }

  return source.slice(0, HEADER_VALUE_MAX_LENGTH).replace(/-+$/g, '') || fallback
}

function buildOpenRouterTitle(pass, requestConfig = {}) {
  if (requestConfig.title) {
    return sanitizeHeaderValue(requestConfig.title)
  }

  const extractorKey = String(pass?.extractorKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!extractorKey) {
    return DEFAULT_OPENROUTER_TITLE
  }

  return sanitizeHeaderValue(`${DEFAULT_OPENROUTER_TITLE}-${extractorKey}`)
}

async function callLlm({
  pass,
  promptPacket,
  runtime = {}
}) {
  const env = require('../../../../../config/env')
  const { generateRawCompletion } = require('../../../../../services/llm.service')
  const startedAt = Date.now()
  const requestConfig = runtime?.llmRequest || {}

  const response = await generateRawCompletion({
    systemPrompt: requestConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    userPrompt: promptPacket?.prompt || '',
    temperature:
      typeof requestConfig.temperature === 'number'
        ? requestConfig.temperature
        : 0,
    max_tokens:
      Number.isFinite(requestConfig.maxTokens)
        ? Number(requestConfig.maxTokens)
        : 2200,
    model: requestConfig.model || env.memoryModel,
    apiUrl: requestConfig.apiUrl || env.memoryLlmApiUrl,
    apiKey: requestConfig.apiKey || env.memoryLlmKey,
    title: buildOpenRouterTitle(pass, requestConfig)
  })

  const rawResponseText = String(response?.choices?.[0]?.message?.content || '').trim()

  return {
    ok: true,
    response,
    rawResponseText,
    rawResponsePreview: buildTextPreview(rawResponseText, 320),
    responseId: response?.id || null,
    model: response?.model || requestConfig.model || env.memoryModel || null,
    usage: response?.usage || null,
    finishReason: response?.choices?.[0]?.finish_reason || null,
    durationMs: getDurationMs(startedAt)
  }
}

module.exports = {
  callLlm,
  sanitizeHeaderValue,
  buildOpenRouterTitle
}
