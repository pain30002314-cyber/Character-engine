'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { enrichWithSystemFields } = require('../../../../src/core/memory/extractors/llm/shared/enrich-with-system-fields')
const { buildEvent, buildPass } = require('../helpers')

test('enrichWithSystemFields appends ids and source metadata', () => {
  const result = enrichWithSystemFields({
    candidates: [
      {
        kind: 'fact_candidate',
        text: 'пример'
      }
    ],
    pass: buildPass(),
    event: buildEvent(),
    promptPacket: {
      promptVersion: 'llm_wide_prompt_v1',
      promptLanguage: 'ru',
      baseEventPacket: {
        event: {
          speakerName: 'Пользователь'
        }
      }
    },
    flowConfig: {
      extractorVersion: '1.0.0',
      promptTransport: 'text'
    },
    llmCall: {
      model: 'mock-model'
    },
    traceId: 'trace-123'
  })

  assert.equal(result.traceId, 'trace-123')
  assert.equal(result.candidates.length, 1)
  assert.equal(result.candidates[0].traceId, 'trace-123')
  assert.equal(result.candidates[0].eventId, 'evt-1')
  assert.equal(result.candidates[0].source.extractor, 'llm_wide')
  assert.equal(result.candidates[0].source.model, 'mock-model')
})
