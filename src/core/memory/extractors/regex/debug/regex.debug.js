'use strict'

const fs = require('fs')
const path = require('path')

const DEBUG_DIR = path.join(process.cwd(), 'data', 'debug')
const DEBUG_FILE = path.join(DEBUG_DIR, 'regex.extractor.log')

function ensureDebugDir() {
  fs.mkdirSync(DEBUG_DIR, { recursive: true })
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return JSON.stringify({
      error: 'failed_to_serialize',
      message: error.message
    }, null, 2)
  }
}

function appendRegexDebugLog(payload) {
  ensureDebugDir()

  const block = [
    safeJson(payload),
    '---'
  ].join('\n')

  fs.appendFileSync(DEBUG_FILE, `${block}\n`, 'utf-8')
}

module.exports = {
  appendRegexDebugLog,
  ensureDebugDir,
  DEBUG_DIR,
  DEBUG_FILE
}