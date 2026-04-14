'use strict'

const assert = require('node:assert/strict')
const { extractRegexAtoms } = require('../src/core/memory/extractors/regex/runtime')

async function run() {
  const result = await extractRegexAtoms({
    event: {
      id: 'evt-basic',
      threadId: 'thread-basic',
      platform: 'telegram',
      channel: 'text',
      role: 'user',
      world: 'Earth',
      timestamp: '2026-04-07T12:00:00.000Z',
      text: 'Я посмотрел на тебя. Почему я выбрал именно эту метафору?',
      language: 'ru',
      replyToEventId: null,
      edited: false,
      attachments: [],
      meta: {}
    }
  })

  const atoms = result.atoms || []

  assert.equal(result.version, 2)
  assert.ok(Array.isArray(atoms))
  assert.ok(Array.isArray(result.signals.questions))
  assert.ok(Array.isArray(result.signals.contextAtoms))
  assert.ok(Array.isArray(result.signals.identityHints))
  assert.ok(Array.isArray(result.signals.temporalAnchors))
  assert.ok(Array.isArray(result.signals.instructions))
  assert.ok(result.service)
  assert.ok(result.service.stats)

  assert.ok(Array.isArray(result.signals.questions))
  assert.ok(Array.isArray(result.signals.contextAtoms))
  assert.ok(Array.isArray(result.signals.identityHints))
  assert.ok(Array.isArray(result.signals.temporalAnchors))
  assert.ok(Array.isArray(result.signals.instructions))

  assert.ok(atoms.some((a) => a.type === 'action' && a.subtype === 'gesture'))
  assert.ok(atoms.some((a) => a.type === 'open_loop' && a.subtype === 'direct_question'))

  assert.strictEqual(result.signals.temporalAnchors.length, 0)
  assert.strictEqual(result.signals.instructions.length, 0)

  console.log('OK')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})