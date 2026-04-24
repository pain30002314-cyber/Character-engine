const express = require('express')
const { handleInput } = require('../core')
const logger = require('../services/logger.service')
const extractionSettings = require('../core/memory/raw/extraction.settings')
const { writeMemoryLiveTrace } = require('../core/memory/debug/memory-debug.service')

const router = express.Router()

router.post('/internal/telegram-relay', async (req, res) => {
  const token = req.headers['x-internal-token']

  if (token !== process.env.INTERNAL_TOKEN) {
    return res.status(403).json({ ok: false, error: 'Forbidden' })
  }

  try {
    const {
      chatId,
      userId,
      username,
      text,
      platform = 'telegram',
      channel = 'text',
      world = 'Earth'
    } = req.body || {}

    const threadId = `${platform}:${chatId}`

    // 📥 Лог входящего сообщения
    logger.info('Incoming Telegram message', {
      chatId,
      userId,
      username,
      threadId,
      textPreview: String(text).slice(0, 120)
    })

    writeMemoryLiveTrace({
      marker: 'live_message_received',
      eventId: null,
      threadId,
      messageId: null,
      memoryExtractionMode: extractionSettings.mode,
      wideLlmExtractorEnabled: extractionSettings.wideLlmExtractorEnabled,
      disablePersistenceWrite: extractionSettings.disablePersistenceWrite,
      note: 'internal.telegram-relay'
    })

    const result = await handleInput({
      chatId,
      userId,
      username,
      text,
      platform,
      channel,
      world,
      threadId
    })

    return res.json({
      ok: true,
      reply: result.reply
    })
  } catch (error) {
    logger.error('Telegram relay error', {
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
