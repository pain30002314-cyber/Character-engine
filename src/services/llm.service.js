const axios = require('axios')
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

  const response = await axios.post(apiUrl, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://localhost',
      'X-OpenRouter-Title': title
    },
    timeout: 60000
  })

  return response.data
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
      const status = error.response?.status
      const data = error.response?.data

      appendUsageLog({
        timestamp: new Date().toISOString(),
        channel: 'reply_error',
        model: env.model,
        status: status || null,
        errorMessage: error.message,
        errorData: data || null,
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
      const status = error.response?.status
      const data = error.response?.data

      appendUsageLog({
        timestamp: new Date().toISOString(),
        channel: 'memory_raw_error',
        model: model || env.memoryModel,
        status: status || null,
        errorMessage: error.message,
        errorData: data || null,
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