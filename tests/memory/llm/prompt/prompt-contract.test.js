'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildBaseEventPacket } = require('../../../../src/core/memory/extractors/llm/shared/build-base-event-packet')
const { buildPrompt } = require('../../../../src/core/memory/extractors/llm/shared/build-prompt')
const { buildEvent, buildEventWindow, buildPass } = require('../helpers')

test('prompt contract keeps minimal json response shape and russian-only human instructions', () => {
  const prompt = buildPrompt(
    buildBaseEventPacket({
      pass: buildPass({ extractorKey: 'entity-object-location' }),
      event: buildEvent({
        text: 'Ваншэн похоронное бюро снова полно гостей.'
      }),
      eventWindow: buildEventWindow()
    }),
    'entity-object-location'
  )

  assert.match(prompt, /Верни строго один JSON-объект/)
  assert.match(prompt, /kind должен быть только из блока "Допустимые kind"/)
  assert.match(prompt, /"candidates": \[/)
  assert.match(prompt, /Если сигналов нет, верни \{"candidates":\[\]\}\./)
  assert.equal(/You are|Return JSON only|English/i.test(prompt), false)
})
