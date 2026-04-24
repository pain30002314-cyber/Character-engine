'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

test('callLlm uses ASCII-only OpenRouter title even when extractorName is Russian', async () => {
  const callLlmPath = require.resolve('../../../../src/core/memory/extractors/llm/shared/call-llm.js')
  const envPath = require.resolve('../../../../src/config/env.js')
  const llmServicePath = require.resolve('../../../../src/services/llm.service.js')

  let capturedTitle = null

  delete require.cache[callLlmPath]
  delete require.cache[envPath]
  delete require.cache[llmServicePath]

  require.cache[envPath] = {
    id: envPath,
    filename: envPath,
    loaded: true,
    exports: {
      memoryModel: 'openai/gpt-5.4-nano',
      memoryLlmApiUrl: 'https://example.invalid',
      memoryLlmKey: 'test-key'
    }
  }

  require.cache[llmServicePath] = {
    id: llmServicePath,
    filename: llmServicePath,
    loaded: true,
    exports: {
      generateRawCompletion: async (input) => {
        capturedTitle = input.title

        return {
          id: 'resp-1',
          model: input.model,
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: '{"candidates":[]}'
              }
            }
          ],
          usage: {
            total_tokens: 10
          }
        }
      }
    }
  }

  try {
    const { callLlm } = require(callLlmPath)

    const result = await callLlm({
      pass: {
        extractorKey: 'emotion-atmosphere-significance',
        extractorName: 'Сигналы эмоций, атмосферы и значимости'
      },
      promptPacket: {
        prompt: 'test prompt'
      }
    })

    assert.equal(result.ok, true)
    assert.equal(
      capturedTitle,
      'Character-engine-memory-wide-extractor-emotion-atmosphere-significance'
    )
    assert.doesNotMatch(capturedTitle, /[^\x20-\x7E]/)
    assert.doesNotMatch(capturedTitle, /[А-Яа-яЁё]/)
  } finally {
    delete require.cache[callLlmPath]
    delete require.cache[envPath]
    delete require.cache[llmServicePath]
  }
})

test('sanitizeHeaderValue strips non-ASCII characters and CRLF', () => {
  const { sanitizeHeaderValue } = require('../../../../src/core/memory/extractors/llm/shared/call-llm.js')

  const value = sanitizeHeaderValue('Русский\r\nHeader: тест')

  assert.doesNotMatch(value, /[^\x20-\x7E]/)
  assert.doesNotMatch(value, /[\r\n]/)
  assert.ok(value.length > 0)
})
