// src/routes/telegram.js
const axios = require('axios')

const env = require('../config/env')
const logger = require('../services/logger.service')
const {
  sendMessage,
  extractAxiosErrorMeta
} = require('../services/telegram.service')
const { handleInput } = require('../core')
const { getThreadId } = require('../core/memory/memory.service')

const TELEGRAM_API = `https://api.telegram.org/bot${env.telegramToken}`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function deleteWebhookIfExists() {
  try {
    const response = await axios.post(`${TELEGRAM_API}/deleteWebhook`, {
      drop_pending_updates: false
    })

    logger.info('Telegram webhook deleted or already absent', {
      ok: response.data?.ok,
      description: response.data?.description
    })
  } catch (error) {
    logger.warn('Failed to delete webhook before polling start', {
      ...extractAxiosErrorMeta(error)
    })
  }
}

async function getUpdates(offset) {
  const response = await axios.get(`${TELEGRAM_API}/getUpdates`, {
    params: {
      timeout: 30,
      offset,
      allowed_updates: ['message']
    },
    timeout: 35000
  })

  if (!response.data?.ok) {
    throw new Error('Telegram getUpdates returned not ok')
  }

  return response.data.result || []
}

async function handleTelegramMessage(message) {
  if (!message || !message.text) {
    return
  }

  const chatId = message.chat?.id
  const userText = message.text
  const userId = message.from?.id ?? null
  const username = message.from?.username || message.from?.first_name || null

  if (!chatId || !userText) {
    return
  }

  const threadId = getThreadId({
    platform: 'telegram',
    chatId
  })

  logger.info('Incoming Telegram message', {
    chatId,
    userId,
    username,
    threadId,
    textPreview: userText.slice(0, 120)
  })

  const result = await handleInput({
    platform: 'telegram',
    channel: 'text',
    threadId,
    text: userText,
    userId,
    username,
    chatId,
    world: 'Earth'
  })

  await sendMessage(chatId, result.reply)
}

async function pollForever() {
  let offset = 0

  logger.info('Telegram polling started')

  while (true) {
    try {
      const updates = await getUpdates(offset)

      for (const update of updates) {
        offset = update.update_id + 1

        try {
          await handleTelegramMessage(update.message)
        } catch (error) {
          logger.error('Failed to handle Telegram update', {
            updateId: update.update_id,
            chatId: update.message?.chat?.id || null,
            textPreview: String(update.message?.text || '').slice(0, 120),
            ...extractAxiosErrorMeta(error),
            stack: error?.stack || null
          })

          const chatId = update.message?.chat?.id

          if (chatId) {
            try {
              await sendMessage(
                chatId,
                'Мгх... мысль споткнулась. Напиши ещё раз.'
              )
            } catch (sendError) {
              logger.error('Failed to send fallback Telegram message', {
                updateId: update.update_id,
                chatId,
                ...extractAxiosErrorMeta(sendError),
                stack: sendError?.stack || null
              })
            }
          }
        }
      }
    } catch (error) {
      logger.error('Telegram polling loop error', {
        offset,
        ...extractAxiosErrorMeta(error),
        stack: error?.stack || null
      })

      await sleep(3000)
    }
  }
}

async function startTelegramPolling() {
  await deleteWebhookIfExists()
  await pollForever()
}

module.exports = {
  startTelegramPolling
}