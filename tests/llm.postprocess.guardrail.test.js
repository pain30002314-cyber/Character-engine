'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  postprocessLlmCandidates
} = require('../src/core/memory/extractors/llm/postprocess')

function buildPacket(candidates) {
  return {
    candidates,
    meta: {
      usedModel: 'openai/gpt-5.4-nano-20260317',
      promptVersion: 'llm_memory_candidates_v1'
    },
    debug: {
      warnings: []
    }
  }
}

function baseCandidate(overrides = {}) {
  return {
    id: 'cand-1',
    kind: 'fact',
    text: 'Тестовый кандидат',
    normalizedText: 'тестовый кандидат',
    summary: null,
    confidence: 0.8,
    semantic: {
      class: 'general_state',
      subclass: null,
      key: 'test_candidate',
      category: 'general',
      tags: ['valid_tag']
    },
    references: {
      subject: {
        ref: 'core_user:main',
        role: 'core_user',
        label: null,
        confidence: 0.9
      },
      object: {
        ref: null,
        role: 'unknown',
        label: null,
        confidence: 0
      },
      about: []
    },
    evidence: {
      kind: 'literal',
      sourceSpans: [],
      quoted: false,
      reported: false,
      negated: false,
      hypothetical: false,
      conditional: false,
      interrogative: false,
      imperative: false,
      hedged: false
    },
    temporal: {
      tense: 'present',
      anchorText: null,
      resolvedAt: null,
      isRecurring: false,
      recurrenceHint: null
    },
    memory: {
      durability: 'episodic',
      salience: 0.7,
      stability: 0.5,
      memoryRelevance: 0.7,
      sensitivity: 'medium',
      confirmationStatus: 'single_shot'
    },
    source: {
      extractor: 'llm',
      model: 'string',
      promptVersion: 'llm_memory_candidates_v1',
      sourceEventId: 'evt-1',
      timestamp: '2026-04-14T17:00:00.000Z'
    },
    ...overrides
  }
}

test('postprocess keeps only super-general remap for internal state mismatch', () => {
  const packet = buildPacket([
    baseCandidate({
      kind: 'relationship',
      text: 'Я очень напряжен и волнуюсь',
      semantic: {
        class: 'emotional_state',
        subclass: 'worry',
        key: 'user_is_worried',
        category: 'emotion',
        tags: ['worry', 'tension']
      }
    })
  ])

  const result = postprocessLlmCandidates(packet)
  assert.equal(result.candidates.length, 1)
  assert.equal(result.candidates[0].kind, 'fact')
})

test('postprocess does not perform domain-specific remap for veterinary update', () => {
  const packet = buildPacket([
    baseCandidate({
      kind: 'relationship',
      text: 'Пару часов назад вет врач звонила и рассказала как он там',
      semantic: {
        class: 'third_party_update',
        subclass: 'veterinary_call_update',
        key: 'vet_called_and_reported_status',
        category: 'care_updates',
        tags: ['vet', 'update']
      },
      references: {
        subject: {
          ref: 'core_user:main',
          role: 'core_user',
          label: null,
          confidence: 0.7
        },
        object: {
          ref: 'third_party:unknown',
          role: 'third_party',
          label: 'вет врач',
          confidence: 0.6
        },
        about: []
      }
    })
  ])

  const result = postprocessLlmCandidates(packet)

  assert.equal(result.candidates.length, 1)
  assert.equal(result.candidates[0].kind, 'relationship')
})

test('postprocess sanitizes invalid semantic tags and sets flags instead of guessing domain meaning', () => {
  const packet = buildPacket([
    baseCandidate({
      text: 'Гарфилд меня беспокоит',
      semantic: {
        class: 'emotional_state',
        subclass: 'worry_about_pet',
        key: 'user_more_worried_about_garfield',
        category: 'emotion',
        tags: ['беспокойство', 'Garfild', 'valid_tag']
      }
    })
  ])

  const result = postprocessLlmCandidates(packet)
  const candidate = result.candidates[0]

  assert.deepEqual(candidate.semantic.tags, ['valid_tag'])
  assert.ok(Array.isArray(candidate.flags))
  assert.ok(candidate.flags.includes('invalid_semantic_tags'))
  assert.ok(candidate.flags.includes('broken_source_model'))
})

test('postprocess nulls structurally broken core_character ref with unknown role', () => {
  const packet = buildPacket([
    baseCandidate({
      text: 'Я волнуюсь за него',
      references: {
        subject: {
          ref: 'core_user:main',
          role: 'core_user',
          label: null,
          confidence: 0.9
        },
        object: {
          ref: 'core_character:active',
          role: 'unknown',
          label: null,
          confidence: 0.2
        },
        about: []
      }
    })
  ])

  const result = postprocessLlmCandidates(packet)
  const candidate = result.candidates[0]

  assert.equal(candidate.references.object.ref, null)
  assert.equal(candidate.references.object.role, 'unknown')
})