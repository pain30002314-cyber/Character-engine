const fs = require('fs')
const path = require('path')
const env = require('../config/env')
const hutao = require('../character/hutao')

const MODEL_PRICING = {
  'anthropic/claude-sonnet-4.6': {
    inputPerMillion: 3,
    outputPerMillion: 15
  },
  'z-ai/glm-5-turbo': {
    inputPerMillion: 1.2,
    outputPerMillion: 4
  },
  'z-ai/glm-4.7': {
    inputPerMillion: 0.39,
    outputPerMillion: 1.75
  },
  'z-ai/glm-4.7-flash': {
    inputPerMillion: 0.06,
    outputPerMillion: 0.40
  },
  'openai/gpt-4o': {
    inputPerMillion: 2.5,
    outputPerMillion: 10
  },
  'meta-llama/llama-3.1-70b-instruct': {
    inputPerMillion: 0.4,
    outputPerMillion: 0.4
  },
  'deepseek/deepseek-v3.2': {
    inputPerMillion: 0.5,
    outputPerMillion: 1.5
  },
  'deepseek/deepseek-v3.2-20251201': {
    inputPerMillion: 0.5,
    outputPerMillion: 1.5
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getModelPricing(model) {
  return MODEL_PRICING[model] || null
}

function calculateCost(model, usage) {
  const pricing = getModelPricing(model)

  if (!pricing || !usage) {
    return null
  }

  const promptTokens = usage.prompt_tokens || 0
  const completionTokens = usage.completion_tokens || 0

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillion
  const totalCost = inputCost + outputCost

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    inputCost,
    outputCost,
    totalCost
  }
}

const LLM_USAGE_LOG_FILE = path.join(process.cwd(), 'data', 'debug', 'llm.usage.log')

function appendUsageLog(payload) {
  try {
    fs.mkdirSync(path.dirname(LLM_USAGE_LOG_FILE), { recursive: true })
    fs.appendFileSync(
      LLM_USAGE_LOG_FILE,
      `${JSON.stringify(payload, null, 2)}\n---\n`,
      'utf-8'
    )
  } catch (error) {
    // намеренно молчим, чтобы не шуметь в консоль
  }
}

function buildTextPreview(value, maxLength = 800) {
  const text = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) {
    return ''
  }

  return text.length > maxLength
    ? `${text.slice(0, maxLength - 1)}…`
    : text
}

function buildMessagePreview(messages = [], maxItems = 4) {
  return (Array.isArray(messages) ? messages : [])
    .slice(0, maxItems)
    .map((message) => ({
      role: message?.role || null,
      contentPreview: buildTextPreview(message?.content, 220)
    }))
}

function buildRequestPayloadPreview({
  apiUrl,
  model,
  messages,
  temperature,
  maxTokens,
  title,
  forceJson
}) {
  return {
    url: apiUrl || null,
    model: model || null,
    temperature:
      typeof temperature === 'number' ? temperature : null,
    max_tokens:
      Number.isFinite(maxTokens) ? Number(maxTokens) : null,
    stream: false,
    response_format: forceJson ? { type: 'json_object' } : null,
    title: title || null,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages: buildMessagePreview(messages)
  }
}

function createRequestError(message, diagnostics = {}) {
  const error = new Error(message || 'openrouter_request_failed')
  error.code = diagnostics.code || 'OPENROUTER_REQUEST_FAILED'
  error.statusCode =
    Number.isFinite(diagnostics.statusCode) ? diagnostics.statusCode : null
  error.details = {
    url: diagnostics.url || null,
    model: diagnostics.model || null,
    status: Number.isFinite(diagnostics.statusCode) ? diagnostics.statusCode : null,
    requestPayloadPreview: diagnostics.requestPayloadPreview || null,
    responseBodyPreview: diagnostics.responseBodyPreview || null
  }
  return error
}

function logUsageAndCost(model, usage, channel = 'unknown') {
  const cost = calculateCost(model, usage)

  appendUsageLog({
    timestamp: new Date().toISOString(),
    channel,
    model,
    usage: usage || null,
    cost: cost || null
  })
}

function normalizeGenerateReplyArgs(input) {
  if (typeof input === 'string') {
    return {
      userMessage: input,
      memoryContext: ''
    }
  }

  return {
    userMessage: input?.userMessage || '',
    memoryContext: input?.memoryContext || ''
  }
}

async function requestOpenRouter({
  apiUrl,
  apiKey,
  model,
  messages,
  temperature,
  maxTokens,
  title,
  forceJson = false
}) {
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false
  }

  if (forceJson) {
    body.response_format = { type: 'json_object' }
  }
  const requestPayloadPreview = buildRequestPayloadPreview({
    apiUrl,
    model,
    messages,
    temperature,
    maxTokens,
    title,
    forceJson
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://localhost',
        'X-OpenRouter-Title': title
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const responseText = await response.text()
    const responseBodyPreview = buildTextPreview(responseText)

    let data = null

    try {
      data = responseText ? JSON.parse(responseText) : {}
    } catch (error) {
      throw createRequestError('openrouter_response_json_parse_failed', {
        code: 'OPENROUTER_RESPONSE_PARSE_FAILED',
        statusCode: response.status,
        url: apiUrl,
        model,
        requestPayloadPreview,
        responseBodyPreview
      })
    }

    if (!response.ok) {
      throw createRequestError(`openrouter_request_failed:${response.status}`, {
        code: 'OPENROUTER_REQUEST_FAILED',
        statusCode: response.status,
        url: apiUrl,
        model,
        requestPayloadPreview,
        responseBodyPreview
      })
    }

    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createRequestError('openrouter_request_timeout', {
        code: 'ETIMEDOUT',
        statusCode: null,
        url: apiUrl,
        model,
        requestPayloadPreview,
        responseBodyPreview: null
      })
    }

    if (error?.details?.requestPayloadPreview) {
      throw error
    }

    throw createRequestError(error?.message || 'openrouter_request_failed', {
      code: error?.code || 'OPENROUTER_REQUEST_FAILED',
      statusCode: error?.statusCode ?? null,
      url: apiUrl,
      model,
      requestPayloadPreview,
      responseBodyPreview: buildTextPreview(
        error?.response?.data ? JSON.stringify(error.response.data) : ''
      )
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function generateReply(input) {
  const { userMessage, memoryContext } = normalizeGenerateReplyArgs(input)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const messages = [
        {
          role: 'system',
          content: hutao.systemPrompt
        }
      ]

      if (memoryContext) {
        messages.push({
          role: 'system',
          content: memoryContext
        })
      }

      messages.push({
        role: 'user',
        content: userMessage
      })

      const data = await requestOpenRouter({
        apiUrl: env.llmApiUrl,
        apiKey: env.llmApiKey,
        model: env.model,
        messages,
        temperature: 0.55,
        maxTokens: 1100,
        title: 'Hu Tao Reply'
      })

      const content = data?.choices?.[0]?.message?.content
      const usage = data?.usage
      const usedModel = data?.model || env.model

      logUsageAndCost(usedModel, usage, 'reply')

      if (!content) {
        throw new Error('OpenRouter returned empty content')
      }

      return content
    } catch (error) {
      const status = error?.statusCode ?? error.response?.status ?? null

      appendUsageLog({
        timestamp: new Date().toISOString(),
        channel: 'reply_error',
        model: env.model,
        status: status || null,
        errorMessage: error.message,
        errorData: error?.details?.responseBodyPreview || error.response?.data || null,
        apiUrl: error?.details?.url || env.llmApiUrl,
        requestPayloadPreview: error?.details?.requestPayloadPreview || null,
        responseBodyPreview: error?.details?.responseBodyPreview || null,
        attempt
      })

      const retryable = [429, 502, 503, 504].includes(status)

      if (!retryable || attempt === 3) {
        throw error
      }

      await sleep(2000 * attempt)
    }
  }
}

async function generateRawCompletion({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  max_tokens = 500,
  model,
  apiUrl,
  apiKey,
  title = 'Hu Tao Memory'
}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const messages = []

      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        })
      }

      messages.push({
        role: 'user',
        content: userPrompt
      })

      const usedApiUrl = apiUrl || env.memoryLlmApiUrl
      const usedApiKey = apiKey || env.memoryLlmKey
      const usedModel = model || env.memoryModel

      const data = await requestOpenRouter({
        apiUrl: usedApiUrl,
        apiKey: usedApiKey,
        model: usedModel,
        messages,
        temperature,
        maxTokens: max_tokens,
        title,
        forceJson: true
      })

      logUsageAndCost(data?.model || usedModel, data?.usage, 'memory_raw')
      return data
    } catch (error) {
      const status = error?.statusCode ?? error.response?.status ?? null

      appendUsageLog({
        timestamp: new Date().toISOString(),
        channel: 'memory_raw_error',
        model: model || env.memoryModel,
        status: status || null,
        errorMessage: error.message,
        errorData: error?.details?.responseBodyPreview || error.response?.data || null,
        apiUrl: error?.details?.url || apiUrl || env.memoryLlmApiUrl,
        requestPayloadPreview: error?.details?.requestPayloadPreview || null,
        responseBodyPreview: error?.details?.responseBodyPreview || null,
        attempt
      })

      const retryable = [429, 502, 503, 504].includes(status)

      if (!retryable || attempt === 3) {
        throw error
      }

      await sleep(2000 * attempt)
    }
  }
}

module.exports = {
  generateReply,
  generateRawCompletion
}
