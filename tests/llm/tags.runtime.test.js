'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const TAGS_RUNTIME_PATH = path.resolve(
  __dirname,
  '../../src/core/memory/extractors/llm/tags.runtime.js'
)
const ENV_PATH = path.resolve(__dirname, '../../src/config/env.js')
const LLM_SERVICE_PATH = path.resolve(__dirname, '../../src/services/llm.service.js')

function loadModuleWithMocks({
  envOverrides = {},
  generateRawCompletionImpl
} = {}) {
  delete require.cache[TAGS_RUNTIME_PATH]
  delete require.cache[ENV_PATH]
  delete require.cache[LLM_SERVICE_PATH]

  require.cache[ENV_PATH] = {
    id: ENV_PATH,
    filename: ENV_PATH,
    loaded: true,
    exports: {
      memoryModel: 'openai/gpt-5.4-nano',
      model: 'deepseek/deepseek-v3.2',
      ...envOverrides
    }
  }

  require.cache[LLM_SERVICE_PATH] = {
    id: LLM_SERVICE_PATH,
    filename: LLM_SERVICE_PATH,
    loaded: true,
    exports: {
      generateRawCompletion:
        generateRawCompletionImpl ||
        (async () => ({
          model: 'openai/gpt-5.4-nano',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  tagUpdates: [
                    {
                      candidateId: 'c1',
                      semanticTags: ['relationship_signal', 'agreement']
                    }
                  ]
                })
              }
            }
          ]
        }))
    }
  }

  return require(TAGS_RUNTIME_PATH)
}

test('runSemanticTagsPatch uses env.memoryModel and parses OpenRouter content from choices[0].message.content', async () => {
  let capturedModel = null

  const { runSemanticTagsPatch } = loadModuleWithMocks({
    envOverrides: {
      memoryModel: 'openai/gpt-5.4-nano',
      model: 'deepseek/deepseek-v3.2'
    },
    generateRawCompletionImpl: async ({ model }) => {
      capturedModel = model

      return {
        model: 'openai/gpt-5.4-nano',
        choices: [
          {
            message: {
              content: JSON.stringify({
                tagUpdates: [
                  {
                    candidateId: 'c1',
                    semanticTags: ['relationship_signal', 'agreement']
                  }
                ]
              })
            }
          }
        ]
      }
    }
  })

  const result = await runSemanticTagsPatch({
    event: { id: 'e1', text: 'ладно, договорились' },
    candidates: [
      {
        id: 'c1',
        kind: 'fact',
        text: 'Пользователь согласился',
        semantic: {
          class: 'relationship',
          subclass: 'agreement',
          key: 'user_agreed',
          category: 'interaction',
          tags: []
        }
      }
    ]
  })

  assert.equal(capturedModel, 'openai/gpt-5.4-nano')
  assert.equal(result.model, 'openai/gpt-5.4-nano')
  assert.deepEqual(result.patch.tagUpdates, [
    {
      candidateId: 'c1',
      semanticTags: ['relationship_signal', 'agreement']
    }
  ])
})

test('applySemanticTagsPatch writes sanitized tags back into candidate.semantic.tags', () => {
  const { applySemanticTagsPatch } = loadModuleWithMocks()

  const packet = {
    candidates: [
      {
        id: 'c1',
        semantic: {
          class: 'relationship',
          tags: []
        }
      },
      {
        id: 'c2',
        semantic: {
          class: 'profile',
          tags: ['existing_tag']
        }
      }
    ]
  }

  const patched = applySemanticTagsPatch(packet, {
    model: 'openai/gpt-5.4-nano',
    patch: {
      tagUpdates: [
        {
          candidateId: 'c1',
          semanticTags: [
            'relationship_signal',
            'Agreement',
            'bad tag',
            'agreement'
          ]
        }
      ]
    }
  })

  assert.deepEqual(patched.candidates[0].semantic.tags, [
    'relationship_signal',
    'agreement'
  ])
  assert.deepEqual(patched.candidates[1].semantic.tags, ['existing_tag'])
  assert.equal(patched.debug.semanticTagsPatch.model, 'openai/gpt-5.4-nano')
  assert.equal(patched.debug.semanticTagsPatch.updatesApplied, 1)
})