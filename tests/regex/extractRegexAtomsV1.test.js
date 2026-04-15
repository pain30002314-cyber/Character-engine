'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { extractRegexAtomsV1 } = require('../../src/core/memory/extractors/regex')

function buildCompatAtoms(result) {
  if (Array.isArray(result?.atoms)) {
    return result.atoms
  }

  const signals = result?.signals || {}

  const questionAtoms = (signals.questions || []).map((item) => ({
    id: item.id,
    type: 'open_loop',
    subtype: item.kind || 'direct_question',
    text: item.text
  }))

  const contextAtoms = (signals.contextAtoms || []).map((item) => ({
    id: item.id,
    type: item.type,
    subtype: item.subtype || 'generic',
    text: item.text
  }))

  return [
    ...questionAtoms,
    ...contextAtoms
  ]
}

async function run(text) {
  const result = await extractRegexAtomsV1({
    event: {
      id: 'evt-test',
      threadId: 'thread-test',
      platform: 'telegram',
      channel: 'text',
      role: 'user',
      world: 'Earth',
      timestamp: '2026-04-07T12:00:00.000Z',
      text,
      language: 'ru',
      replyToEventId: null,
      edited: false,
      attachments: [],
      meta: {}
    }
  })

  return {
    ...result,
    atoms: buildCompatAtoms(result)
  }
}

function countAtoms(result, type, subtype = null) {
  return result.atoms.filter((item) => {
    if (item.type !== type) return false
    if (subtype && item.subtype !== subtype) return false
    return true
  }).length
}

test('returns stable narrowed contract', async () => {
  const result = await run('Меня зовут Андрей.')

  assert.equal(result.version, 2)
  assert.ok(Array.isArray(result.atoms))
  assert.ok(Array.isArray(result.signals.questions))
  assert.ok(Array.isArray(result.signals.contextAtoms))
  assert.ok(Array.isArray(result.signals.identityHints))
  assert.ok(Array.isArray(result.signals.temporalAnchors))
  assert.ok(Array.isArray(result.signals.instructions))
  assert.ok(result.service)
  assert.ok(result.service.stats)

  assert.equal(result.signals.temporalAnchors.length, 0)
  assert.equal(result.signals.instructions.length, 0)
})

test('keeps explicit location scene', async () => {
  const result = await run('Мы в вет клинике.')

  assert.equal(countAtoms(result, 'scene', 'location'), 1)
})

test('keeps explicit location scene', async () => {
  const result = await run('*Я сел рядом с тобой*')

  assert.equal(countAtoms(result, 'scene', 'location'), 1)
})

test('keeps short rp bodily action', async () => {
  const result = await run('*Я вздохнул*')

  assert.equal(countAtoms(result, 'action', 'gesture'), 1)
})

test('keeps observational gesture without rp markup', async () => {
  const result = await run('Я посмотрел на тебя.')

  assert.equal(countAtoms(result, 'action', 'gesture'), 1)
})

test('keeps glance gesture without rp markup', async () => {
  const result = await run('Я глянул в сторону двери.')

  assert.equal(countAtoms(result, 'action', 'gesture'), 1)
})

test('does not keep weak shrug as meaningful action', async () => {
  const result = await run('*Я пожал плечами*')

  assert.equal(countAtoms(result, 'action', 'gesture'), 0)
})

test('keeps physical interaction from nose poke rp even in mixed message', async () => {
  const result = await run('Нужно немного поговорить.\n\n*Я легонько тыкнул тебя в кончик носа*')

  assert.equal(countAtoms(result, 'action', 'physical'), 1)
})

test('extracts physical touch from fingers on cheek rp', async () => {
  const result = await run('*Я легонько положил кончики пальцев тебе на щеку*')

  assert.equal(countAtoms(result, 'action', 'physical'), 1)
})

test('extracts physical action from started kissing rp', async () => {
  const result = await run('*Я навис над тобой и начал целовать тебя в щеки в разные места*')

  assert.equal(countAtoms(result, 'action', 'physical'), 1)
})

test('keeps direct question as open loop', async () => {
  const result = await run('Почему я выбрал именно эту метафору?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 1)
})

test('keeps soft short question as open loop', async () => {
  const result = await run('Как ночка?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 1)
})

test('does not create open loop from decorative alternative', async () => {
  const result = await run('Или просто «приходи, потому что надо приходить»?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 0)
})

test('does not create open loop from conditional rhetorical question', async () => {
  const result = await run('Если я скажу правду, ты все равно решишь, что я лгу?')

  assert.equal(countAtoms(result, 'open_loop'), 0)
})

test('keeps postponed topic open loop', async () => {
  const result = await run('Потом вернемся к этому.')

  assert.equal(countAtoms(result, 'open_loop', 'postponed_topic'), 1)
})

test('keeps suspended topic open loop', async () => {
  const result = await run('Пока не хочу это обсуждать.')

  assert.equal(countAtoms(result, 'open_loop', 'suspended_topic'), 1)
})

test('keeps future task open loop', async () => {
  const result = await run('Завтра проверю это.')

  assert.equal(countAtoms(result, 'open_loop', 'pending_task'), 1)
})

test('keeps pending decision open loop', async () => {
  const result = await run('Надо решить, что делать дальше.')

  assert.equal(countAtoms(result, 'open_loop', 'pending_decision'), 1)
})

test('keeps direct affect marker', async () => {
  const result = await run('Мне тревожно.')

  assert.equal(countAtoms(result, 'affect', 'fear'), 1)
})

test('keeps longer direct affect marker without hard word limit', async () => {
  const result = await run('Мне сейчас очень тревожно после слов ветеринара, хотя внешне я спокоен.')

  assert.equal(countAtoms(result, 'affect', 'fear'), 1)
})

test('keeps explicit need intent', async () => {
  const result = await run('Мне нужно проверить сервер.')

  assert.equal(countAtoms(result, 'intent', 'needed'), 1)
})

test('keeps generic need intent', async () => {
  const result = await run('Надо посмотреть логи.')

  assert.equal(countAtoms(result, 'intent', 'needed'), 1)
})

test('keeps future intent with time hint', async () => {
  const result = await run('Завтра проверю все еще раз.')

  assert.equal(countAtoms(result, 'intent', 'planned'), 1)
})

test('keeps entity for hu tao', async () => {
  const result = await run('Ху Тао сегодня молчит.')

  assert.equal(countAtoms(result, 'entity', 'character'), 1)
})

test('keeps entity for garfield', async () => {
  const result = await run('Гарфилд сейчас у ветеринара.')

  assert.equal(countAtoms(result, 'entity', 'pet'), 1)
})

test('keeps entity for semka', async () => {
  const result = await run('Семка снова спрятался.')

  assert.equal(countAtoms(result, 'entity', 'pet'), 1)
})

test('keeps entity for dymok', async () => {
  const result = await run('Дымок сегодня спокойный.')

  assert.equal(countAtoms(result, 'entity', 'pet'), 1)
})

test('keeps entity for chumuska', async () => {
  const result = await run('Чумуска снова требует внимания.')

  assert.equal(countAtoms(result, 'entity', 'pet'), 1)
})

test('keeps owned venue entity', async () => {
  const result = await run('В моем заведении сегодня тихо.')

  assert.equal(countAtoms(result, 'entity', 'place'), 1)
})

test('keeps coffee shop entity', async () => {
  const result = await run('В кофейне сегодня новая смена.')

  assert.equal(countAtoms(result, 'entity', 'place'), 1)
})

test('keeps mostik project entity', async () => {
  const result = await run('Мостик пока двигается медленно.')

  assert.equal(countAtoms(result, 'entity', 'project'), 1)
})

test('keeps chatgpt system entity', async () => {
  const result = await run('Мы с ChatGPT сейчас допиливаем проект.')

  assert.equal(countAtoms(result, 'entity', 'system'), 1)
})

test('keeps telegram system entity', async () => {
  const result = await run('Пока общаемся через телегу.')

  assert.equal(countAtoms(result, 'entity', 'system'), 1)
})

test('keeps server system entity in project context', async () => {
  const result = await run('Проект лежит на сервере.')

  assert.equal(countAtoms(result, 'entity', 'system'), 1)
})

test('does not emit temporal anchors under narrowed contract', async () => {
  const result = await run('Я 4 дня.')

  assert.equal(result.signals.temporalAnchors.length, 0)
  assert.equal(countAtoms(result, 'temporal'), 0)
})