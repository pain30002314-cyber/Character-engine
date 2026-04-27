'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildBaseEventPacket } = require('../../../../src/core/memory/extractors/llm/shared/build-base-event-packet')
const { buildPrompt } = require('../../../../src/core/memory/extractors/llm/shared/build-prompt')
const { buildEvent, buildEventWindow, buildPass } = require('../helpers')

test('buildPrompt returns Russian text packet with required sections and localized time', () => {
  const packet = buildBaseEventPacket({
    pass: buildPass({ extractorKey: 'fact' }),
    event: buildEvent({
      timestamp: '2026-04-23T12:34:56.000Z'
    }),
    eventWindow: buildEventWindow()
  })

  const prompt = buildPrompt(packet, 'fact')

  assert.throws(() => JSON.parse(prompt))
  assert.match(prompt, /Роль/)
  assert.match(prompt, /Что искать:/)
  assert.match(prompt, /Что не делать:/)
  assert.match(prompt, /Правила извлечения/)
  assert.match(prompt, /Метаданные события/)
  assert.match(prompt, /Текущее сообщение/)
  assert.match(prompt, /Недавний контекст/)
  assert.match(prompt, /Быстрые сигналы/)
  assert.match(prompt, /Допустимые kind/)
  assert.match(prompt, /fact_candidate — отдельное утверждение или наблюдаемый факт/)
  assert.match(prompt, /Формат ответа/)
  assert.ok(prompt.indexOf('Допустимые kind') < prompt.indexOf('Формат ответа'))
  assert.equal(prompt.includes('2026-04-23T12:34:56.000Z'), false)
  assert.match(prompt, /UTC\+7/)
  assert.match(prompt, /19:34/)
  assert.equal(prompt.includes('semantic.tags'), false)
})
