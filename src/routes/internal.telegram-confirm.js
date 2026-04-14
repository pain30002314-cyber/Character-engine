const express = require('express')
const { recordAssistantMessage } = require('../core/memory/memory.service')
const logger = require('../services/logger.service')

const router = express.Router()

router.post('/internal/telegram-confirm', async (req, res) => {
  const token = req.headers['x-internal-token']

  if (token !== process.env.INTERNAL_TOKEN) {
    return res.status(403).json({ ok: false, error: 'Forbidden' })
  }

  try {
    const {
      chatId,
      text,
      platform = 'telegram',
      channel = 'text',
      world = 'Earth'
    } = req.body || {}

    const threadId = `${platform}:${chatId}`

    await recordAssistantMessage({
      threadId,
      text,
      platform,
      channel,
      world,
      chatId
    })

    // 📤 Лог исходящего сообщения
    logger.info('Outgoing Telegram message', {
      chatId,
      threadId,
      textPreview: String(text).slice(0, 120)
    })

    return res.json({ ok: true })
  } catch (error) {
    logger.error('Telegram confirm error', {
      message: error.message,
      stack: error.stack
    })

    return res.status(500).json({
      ok: false,
      error: 'Internal server error'
    })
  }
})

module.exports = router