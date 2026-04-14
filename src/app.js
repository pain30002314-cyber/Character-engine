require('dotenv').config()
const express = require('express')
const logger = require('./services/logger.service')
const { startTelegramPolling } = require('./routes/telegram')
const telegramRelay = require('./routes/internal.telegram-relay')
const telegramConfirm = require('./routes/internal.telegram-confirm')
const { ensureTimeContextFile } = require('./services/time-context.service')

const app = express()

app.use(express.json())
app.use(telegramRelay)
app.use(telegramConfirm)

async function bootstrap() {
  ensureTimeContextFile()
  
  logger.info('App bootstrap started', {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3000
  })

  app.listen(Number(process.env.PORT) || 3000, () => {
    logger.info('HTTP server started', {
      port: Number(process.env.PORT) || 3000
    })
  })

  if (process.env.ENABLE_TELEGRAM === 'true') {
    await startTelegramPolling()
  }
}

bootstrap()