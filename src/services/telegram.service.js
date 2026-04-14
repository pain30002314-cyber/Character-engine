require('dotenv').config()
const axios = require('axios')
const https = require('https')
const logger = require('./logger.service')

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`
const TELEGRAM_LIMIT = 4000
const SEND_TIMEOUT_MS = 8000

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNABORTED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH'
])

const telegramHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function splitTextIntoChunks(text, maxLen = TELEGRAM_LIMIT) {
  if (!text) return ['']

  const normalized = String(text).replace(/\r\n/g, '\n')
  const chunks = []

  let remaining = normalized

  while (remaining.length > maxLen) {
    let splitIndex = remaining.lastIndexOf('\n', maxLen)

    if (splitIndex < maxLen * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLen)
    }

    if (splitIndex < maxLen * 0.5) {
      splitIndex = maxLen
    }

    chunks.push(remaining.slice(0, splitIndex).trim())
    remaining = remaining.slice(splitIndex).trim()
  }

  if (remaining.length > 0) {
    chunks.push(remaining)
  }

  return chunks.filter(Boolean)
}

function extractAxiosErrorMeta(error) {
  return {
    message: error?.message || 'unknown_error',
    code: error?.code || null,
    status: error?.response?.status || null,
    responseData: error?.response?.data || null,
    cause: error?.cause?.message || null,
    isAxiosError: Boolean(error?.isAxiosError),
    nestedErrors: Array.isArray(error?.errors)
      ? error.errors.map((item) => ({
          message: item?.message || null,
          code: item?.code || null,
          errno: item?.errno || null,
          syscall: item?.syscall || null,
          address: item?.address || null,
          port: item?.port || null
        }))
      : []
  }
}

function isRetryableTelegramError(error) {
  const status = error?.response?.status || null
  const code = error?.code || null

  if (status && RETRYABLE_STATUS.has(status)) {
    return true
  }

  if (code && RETRYABLE_CODES.has(code)) {
    return true
  }

  if (Array.isArray(error?.errors)) {
    return error.errors.some((item) => item?.code && RETRYABLE_CODES.has(item.code))
  }

  return false
}

async function sendSingleMessage(chatId, text, options = {}) {
  const {
    attempt = 1,
    maxAttempts = 3,
    chunkIndex = 0,
    totalChunks = 1
  } = options

  try {
    const response = await axios.post(
      `${TELEGRAM_API}/sendMessage`,
      {
        chat_id: chatId,
        text
      },
      {
        timeout: SEND_TIMEOUT_MS,
        httpsAgent: telegramHttpsAgent,
        family: 4
      }
    )

    if (attempt > 1) {
      logger.warn('Telegram message sent after retry', {
        chatId,
        attempt,
        chunkIndex,
        totalChunks,
        ok: response?.data?.ok === true,
        messageId: response?.data?.result?.message_id || null
      })
    } else {
      logger.debug('Telegram message sent', {
        chatId,
        attempt,
        chunkIndex,
        totalChunks,
        ok: response?.data?.ok === true,
        messageId: response?.data?.result?.message_id || null
      })
    }

    return response.data
  } catch (error) {
    const meta = extractAxiosErrorMeta(error)

    logger.error('Telegram sendMessage failed', {
      chatId,
      attempt,
      maxAttempts,
      chunkIndex,
      totalChunks,
      textPreview: String(text || '').slice(0, 160),
      ...meta
    })

    const retryable = isRetryableTelegramError(error)

    if (!retryable || attempt >= maxAttempts) {
      throw error
    }

    await sleep(1200 * attempt)

    return sendSingleMessage(chatId, text, {
      attempt: attempt + 1,
      maxAttempts,
      chunkIndex,
      totalChunks
    })
  }
}

async function sendMessage(chatId, text) {
  const chunks = splitTextIntoChunks(text)

  for (let index = 0; index < chunks.length; index += 1) {
    await sendSingleMessage(chatId, chunks[index], {
      attempt: 1,
      maxAttempts: 3,
      chunkIndex: index + 1,
      totalChunks: chunks.length
    })
  }
}

module.exports = {
  sendMessage,
  splitTextIntoChunks,
  extractAxiosErrorMeta,
  isRetryableTelegramError
}