'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  parseSemanticTagsPatch,
  applySemanticTagsPatch
} = require('../src/core/memory/extractors/llm/tags/normalize')

test('parseSemanticTagsPatch keeps only valid english schema tags', () => {
  const raw = JSON.stringify({
    tagUpdates: [
      {
        candidateId: 'c1',
        semanticTags: ['patch', 'готово', 'evaluation', 'post_patch']
      },
      {
        candidateId: 'c2',
        semanticTags: ['request', 'оценка']
      }
    ]
  })

  const result = parseSemanticTagsPatch(raw)

  assert.deepEqual(result, {
    tagUpdates: [
      {
        candidateId: 'c1',
        semanticTags: ['patch', 'evaluation', 'post_patch']
      },
      {
        candidateId: 'c2',
        semanticTags: ['request']
      }
    ]
  })
})

test('applySemanticTagsPatch updates only semantic.tags and clears invalid tag flag', () => {
  const packet = {
    candidates: [
      {
        id: 'c1',
        kind: 'fact',
        text: 'Экстрактор пропатчил.',
        flags: ['invalid_semantic_tags'],
        semantic: {
          class: 'tech_change',
          subclass: 'extractor_patch',
          key: 'extractor_patched',
          category: 'system_update_status',
          tags: []
        }
      },
      {
        id: 'c2',
        kind: 'goal',
        text: 'Давай оценим как работает теперь.',
        flags: ['invalid_semantic_tags'],
        semantic: {
          class: 'evaluation_request',
          subclass: 'post_patch_evaluation',
          key: 'evaluate_updated_extractor',
          category: 'system_assessment_request',
          tags: []
        }
      }
    ]
  }

  const patch = {
    tagUpdates: [
      {
        candidateId: 'c1',
        semanticTags: ['patch', 'extractor_update']
      },
      {
        candidateId: 'c2',
        semanticTags: ['evaluation', 'request']
      }
    ]
  }

  const result = applySemanticTagsPatch(packet, patch)

  assert.deepEqual(result.candidates[0].semantic.tags, ['patch', 'extractor_update'])
  assert.deepEqual(result.candidates[1].semantic.tags, ['evaluation', 'request'])
  assert.deepEqual(result.candidates[0].flags, [])
  assert.deepEqual(result.candidates[1].flags, [])
  assert.equal(result.candidates[0].kind, 'fact')
  assert.equal(result.candidates[1].kind, 'goal')
})