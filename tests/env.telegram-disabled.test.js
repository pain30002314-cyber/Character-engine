'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

function loadEnvModule() {
  const modulePath = require.resolve('../src/config/env')
  delete require.cache[modulePath]
  return require('../src/config/env')
}

test('env does not require TELEGRAM_TOKEN when ENABLE_TELEGRAM is false', () => {
  const previous = {
    ENABLE_TELEGRAM: process.env.ENABLE_TELEGRAM,
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_API_URL: process.env.LLM_API_URL,
    MODEL: process.env.MODEL
  }

  process.env.ENABLE_TELEGRAM = 'false'
  delete process.env.TELEGRAM_TOKEN
  process.env.LLM_API_KEY = 'test-key'
  process.env.LLM_API_URL = 'http://127.0.0.1/mock'
  process.env.MODEL = 'mock-model'

  try {
    const env = loadEnvModule()

    assert.equal(env.telegramEnabled, false)
    assert.equal(env.telegramToken, null)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})
