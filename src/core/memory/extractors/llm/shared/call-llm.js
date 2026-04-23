'use strict'

const { getDurationMs } = require('../utils/time')
const { buildTextPreview } = require('../utils/preview')

const DEFAULT_SYSTEM_PROMPT = [
  'Ты извлекаешь сигналы памяти из сообщения.',
  'Верни только JSON-объект с массивом candidates.',
  'Не добавляй пояснения вне JSON.'
].join(' ')

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
    title: requestConfig.title || `Character Engine Memory Extractor: ${pass?.extractorName || 'LLM Pass'}`
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
  callLlm
}
