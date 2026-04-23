'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

test('app bootstrap starts http server without telegram polling when ENABLE_TELEGRAM=false', async () => {
  const appPath = require.resolve('../../../../src/app.js')
  const expressPath = require.resolve('express')
  const loggerPath = require.resolve('../../../../src/services/logger.service')
  const telegramPath = require.resolve('../../../../src/routes/telegram')
  const relayPath = require.resolve('../../../../src/routes/internal.telegram-relay')
  const confirmPath = require.resolve('../../../../src/routes/internal.telegram-confirm')
  const timeContextPath = require.resolve('../../../../src/services/time-context.service')
  const previousEnableTelegram = process.env.ENABLE_TELEGRAM
  const previousPort = process.env.PORT

  let listenPort = null
  let telegramStarted = false
  const uses = []

  delete require.cache[appPath]
  delete require.cache[expressPath]
  delete require.cache[loggerPath]
  delete require.cache[telegramPath]
  delete require.cache[relayPath]
  delete require.cache[confirmPath]
  delete require.cache[timeContextPath]

  process.env.ENABLE_TELEGRAM = 'false'
  process.env.PORT = '3211'

  require.cache[expressPath] = {
    id: expressPath,
    filename: expressPath,
    loaded: true,
    exports: Object.assign(
      function express() {
        return {
          use(value) {
            uses.push(value)
          },
          listen(port, callback) {
            listenPort = port
            if (typeof callback === 'function') {
              callback()
            }
            return { close() {} }
          }
        }
      },
      {
        json() {
          return 'json-middleware'
        }
      }
    )
  }

  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: {
      info() {},
      warn() {},
      error() {},
      debug() {}
    }
  }

  require.cache[telegramPath] = {
    id: telegramPath,
    filename: telegramPath,
    loaded: true,
    exports: {
      async startTelegramPolling() {
        telegramStarted = true
      }
    }
  }

  require.cache[relayPath] = {
    id: relayPath,
    filename: relayPath,
    loaded: true,
    exports: 'relay-router'
  }

  require.cache[confirmPath] = {
    id: confirmPath,
    filename: confirmPath,
    loaded: true,
    exports: 'confirm-router'
  }

  require.cache[timeContextPath] = {
    id: timeContextPath,
    filename: timeContextPath,
    loaded: true,
    exports: {
      ensureTimeContextFile() {}
    }
  }

  try {
    require(appPath)
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(listenPort, 3211)
    assert.equal(telegramStarted, false)
    assert.ok(uses.includes('json-middleware'))
    assert.ok(uses.includes('relay-router'))
    assert.ok(uses.includes('confirm-router'))
  } finally {
    if (previousEnableTelegram === undefined) {
      delete process.env.ENABLE_TELEGRAM
    } else {
      process.env.ENABLE_TELEGRAM = previousEnableTelegram
    }

    if (previousPort === undefined) {
      delete process.env.PORT
    } else {
      process.env.PORT = previousPort
    }
  }
})
