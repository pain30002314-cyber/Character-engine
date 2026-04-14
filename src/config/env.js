require('dotenv').config()

function requireEnv(name) {
  const value = process.env[name]

  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required env variable: ${name}`)
  }

  return value
}

function numberEnv(name, fallback) {
  const raw = process.env[name]

  if (raw === undefined || raw === null || raw === '') {
    return fallback
  }

  const parsed = Number(raw)

  if (Number.isNaN(parsed)) {
    throw new Error(`Env variable ${name} must be a number`)
  }

  return parsed
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberEnv('PORT', 3000),

  telegramToken: requireEnv('TELEGRAM_TOKEN'),

  llmApiKey: requireEnv('LLM_API_KEY'),
  llmApiUrl: requireEnv('LLM_API_URL'),
  model: requireEnv('MODEL'),

  memoryLlmApiUrl: process.env.MEMORY_LLM_API_URL || process.env.LLM_API_URL,
  memoryLlmKey: process.env.MEMORY_LLM_KEY || process.env.LLM_API_KEY,
  memoryModel: process.env.MEMORY_MODEL || process.env.MODEL,

  memorySummarizerApiUrl:
    process.env.MEMORY_SUMMARIZER_API_URL || process.env.LLM_API_URL,
  memorySummarizerKey:
    process.env.MEMORY_SUMMARIZER_KEY || process.env.LLM_API_KEY,
  memorySummarizerModel:
    process.env.MEMORY_SUMMARIZER_MODEL || process.env.MEMORY_MODEL || process.env.MODEL
}

module.exports = env