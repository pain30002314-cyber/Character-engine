'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

function buildEvent(overrides = {}) {
  return {
    id: 'evt-1',
    threadId: 'thread-1',
    role: 'user',
    platform: 'telegram',
    channel: 'text',
    world: 'Earth',
    timestamp: '2026-04-23T12:00:00.000Z',
    text: 'Ху Тао снова шутит, но потом резко стала серьезной.',
    meta: {},
    ...overrides
  }
}

function buildEventWindow(items = []) {
  return items.length > 0
    ? items
    : [
        {
          id: 'ctx-1',
          role: 'assistant',
          timestamp: '2026-04-23T11:59:00.000Z',
          text: 'Я слушаю тебя внимательно.'
        }
      ]
}

function buildPass(overrides = {}) {
  return {
    extractorKey: 'fact',
    extractorName: 'Fact Pass',
    role: 'fact_extractor',
    ...overrides
  }
}

function buildCandidate(overrides = {}) {
  return {
    id: 'cand-1',
    candidateId: 'cand-1',
    kind: 'fact_candidate',
    text: 'Ху Тао стала серьезной.',
    summary: 'Смена эмоционального тона Ху Тао',
    importance: 'средняя',
    tags: ['ху тао', 'серьезность'],
    payload: {
      subject: 'Ху Тао'
    },
    sourcePass: 'fact',
    flags: [],
    ...overrides
  }
}

function buildCandidatePool(overrides = {}) {
  return {
    traceId: 'trace-1',
    eventId: 'evt-1',
    threadId: 'thread-1',
    candidates: [buildCandidate()],
    ...overrides
  }
}

function createTempDir(prefix = 'character-memory-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function freshRequire(modulePath) {
  const resolved = path.isAbsolute(modulePath)
    ? require.resolve(modulePath)
    : require.resolve(path.resolve(REPO_ROOT, modulePath))
  delete require.cache[resolved]
  return require(resolved)
}

module.exports = {
  buildEvent,
  buildEventWindow,
  buildPass,
  buildCandidate,
  buildCandidatePool,
  createTempDir,
  freshRequire
}
