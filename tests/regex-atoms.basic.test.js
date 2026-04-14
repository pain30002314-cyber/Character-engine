const assert = require('assert')
const { extractRegexAtomsV1 } = require('../src/core/memory/extractors/regex')

function buildCompatAtoms(result) {
  const signals = result?.signals || {}

  const questionAtoms = (signals.questions || []).map((item) => ({
    type: 'open_loop',
    subtype: item.kind || 'direct_question',
    text: item.text
  }))

  const identityAtoms = (signals.identityHints || []).map((item) => ({
    type: 'identity',
    subtype: item.kind === 'display_name_candidate' ? 'display_name' : 'role',
    text: item.value
  }))

  const contextAtoms = (signals.contextAtoms || []).map((item) => ({
    type: item.type,
    subtype: item.subtype,
    text: item.text
  }))

  return [
    ...identityAtoms,
    ...questionAtoms,
    ...contextAtoms
  ]
}

async function run() {
  const result = await extractRegexAtomsV1({
    event: {
      id: 'evt-test',
      threadId: 'thread-test',
      platform: 'telegram',
      channel: 'text',
      role: 'user',
      world: 'Earth',
      timestamp: '2026-04-07T12:00:00.000Z',
      text: 'Меня зовут Андрей. Я люблю тебя. Почему я выбрал именно эту метафору?',
      language: 'ru',
      replyToEventId: null,
      edited: false,
      attachments: [],
      meta: {}
    }
  })

  const atoms = buildCompatAtoms(result)

  assert.strictEqual(result.version, 2)
  assert.strictEqual(result.strategy, 'regex_fast_signals_v1')

  assert.ok(result.signals)
  assert.ok(Array.isArray(result.signals.identityHints))
  assert.ok(Array.isArray(result.signals.contextAtoms))
  assert.ok(Array.isArray(result.signals.questions))

  assert.ok(atoms.some((a) => a.type === 'identity' && a.subtype === 'display_name'))
  assert.ok(atoms.some((a) => a.type === 'relationship' && a.subtype === 'affection'))
  assert.ok(atoms.some((a) => a.type === 'open_loop' && a.subtype === 'direct_question'))

  console.log('OK')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})