'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

test('evaluateLlmCandidateBatchV1 returns enriched batch from valid llm response', async () => {
  const llmServicePath = require.resolve('../src/services/llm.service')
  const runtimePath = require.resolve('../src/core/memory/filters/llm/runtime')

  const originalLlmService = require(llmServicePath)

  require.cache[llmServicePath].exports = {
    ...originalLlmService,
    generateRawCompletion: async () => ({
      id: 'resp_1',
      model: 'mock-model',
      usage: { total_tokens: 123 },
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              evaluations: [
                {
                  candidate_id: 'cand_1',
                  filter: {
                    is_noise: false,
                    groundedness: 'high',
                    future_utility: 'medium',
                    stability: 'low',
                    ambiguity: 'medium'
                  },
                  routing: {
                    decision: 'stage_candidate',
                    reason_codes: ['emotion_signal', 'needs_accumulation']
                  },
                  memory_proposal: {
                    class: 'relationship_signal',
                    priority: 'medium',
                    promotion_mode: 'needs_accumulation'
                  }
                }
              ]
            })
          }
        }
      ]
    })
  }

  delete require.cache[runtimePath]
  const { evaluateLlmCandidateBatchV1 } = require(runtimePath)

  try {
    const result = await evaluateLlmCandidateBatchV1({
      extractorPacket: {
        event: {
          id: 'evt_1',
          threadId: 'telegram:test',
          text: 'Мне приходится каждый раз заново передавать тебе это чувство'
        },
        candidates: [
          {
            id: 'cand_1',
            kind: 'relationship',
            text: 'Мне приходится каждый раз заново передавать тебе это чувство'
          }
        ]
      }
    })

    assert.equal(result.filter_version, 'v1')
    assert.equal(result.candidates.length, 1)
    assert.equal(result.candidates[0].routing.decision, 'stage_candidate')
    assert.equal(result.candidates[0].memory_proposal.class, 'relationship_signal')
    assert.equal(result.batch_summary.stage_candidate, 1)
  } finally {
    require.cache[llmServicePath].exports = originalLlmService
    delete require.cache[runtimePath]
  }
})