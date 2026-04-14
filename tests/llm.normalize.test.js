'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeMemoryCandidatesPacket
} = require('../src/core/memory/extractors/llm/normalize')
const {
  postprocessLlmCandidates
} = require('../src/core/memory/extractors/llm/postprocess')
const {
  candidateToRawClaim
} = require('../src/core/memory/raw/strategies/llm.strategy')
const {
  resolveClaimRefs
} = require('../src/core/memory/pipeline/interpret.pipeline')

function buildPacket(candidates) {
  return {
    event: {
      id: 'evt-1',
      threadId: 'thread-1',
      role: 'user',
      platform: 'telegram',
      channel: 'text',
      world: 'Earth',
      timestamp: '2026-04-14T12:00:00.000Z',
      text: 'Тестовое сообщение.',
      meta: {}
    },
    context: {
      eventWindow: [],
      identity: {
        coreUserRef: 'core_user:main',
        coreCharacterRef: 'core_character:active',
        userDisplayName: null,
        characterDisplayName: 'Ху Тао'
      }
    },
    candidates,
    temporal: {
      messageTime: '2026-04-14T12:00:00.000Z',
      anchors: []
    },
    meta: {
      usedModel: 'gpt-5.2',
      promptVersion: 'llm_memory_candidates_v1',
      extractorVersion: '2.0.0',
      durationMs: 42
    },
    debug: {
      warnings: []
    }
  }
}

test('normalizer keeps packet contract and postprocess sanitizes model and tags', () => {
  const normalized = normalizeMemoryCandidatesPacket(buildPacket([
    {
      id: 'cand-1',
      kind: 'relationship',
      text: 'Мне тяжело после этого разговора.',
      normalizedText: 'Мне тяжело после этого разговора.',
      confidence: 0.81,
      semantic: {
        class: 'emotional_state',
        subclass: 'internal_state',
        key: 'current_distress',
        category: 'distress_state',
        tags: ['distress', 'эмоция', 'distress']
      },
      references: {
        subject: {
          ref: 'core_user:main',
          role: 'core_user',
          label: 'пользователь',
          confidence: 0.9
        },
        object: {
          ref: 'core_character:active',
          role: 'core_character',
          label: 'Ху Тао',
          confidence: 0.7
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
        durability: 'transient',
        salience: 0.82,
        stability: 0.62,
        memoryRelevance: 0.76,
        sensitivity: 'medium',
        confirmationStatus: 'single_shot'
      },
      source: {
        extractor: 'llm',
        model: 'string',
        promptVersion: 'llm_memory_candidates_v1',
        sourceEventId: 'evt-1',
        timestamp: '2026-04-14T12:00:00.000Z'
      }
    }
  ]))

  const result = postprocessLlmCandidates(normalized)

  assert.equal(result.candidates.length, 1)
  assert.equal(result.candidates[0].kind, 'fact')
  assert.equal(result.candidates[0].source.model, 'gpt-5.2')
  assert.deepEqual(result.candidates[0].semantic.tags, ['distress'])
  assert.equal(result.debug.postprocess.remappedCandidates, 1)
})

test('drops explicit workflow chatter without turning postprocess into parser', () => {
  const normalized = normalizeMemoryCandidatesPacket(buildPacket([
    {
      id: 'cand-2',
      kind: 'commitment',
      text: 'Сначала надо доделать mem0 pipeline и проверить logs после patch.',
      normalizedText: 'Сначала надо доделать mem0 pipeline и проверить logs после patch.',
      confidence: 0.72,
      semantic: {
        class: 'project_workflow',
        subclass: 'memory_pipeline',
        key: 'workflow_followup',
        category: 'technical_workflow',
        tags: ['pipeline', 'mem0']
      },
      references: {
        subject: {
          ref: 'core_user:main',
          role: 'core_user',
          label: 'пользователь',
          confidence: 0.9
        },
        object: {
          ref: 'core_character:active',
          role: 'core_character',
          label: 'Ху Тао',
          confidence: 0.5
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
        tense: 'future',
        anchorText: null,
        resolvedAt: null,
        isRecurring: false,
        recurrenceHint: null
      },
      memory: {
        durability: 'transient',
        salience: 0.5,
        stability: 0.3,
        memoryRelevance: 0.28,
        sensitivity: 'low',
        confirmationStatus: 'uncertain'
      },
      source: {
        extractor: 'llm',
        model: 'gpt-5.2',
        promptVersion: 'llm_memory_candidates_v1',
        sourceEventId: 'evt-1',
        timestamp: '2026-04-14T12:00:00.000Z'
      }
    }
  ]))

  const result = postprocessLlmCandidates(normalized)

  assert.equal(result.candidates.length, 0)
  assert.equal(result.debug.postprocess.droppedCandidates, 1)
})

test('repairs garfield medical references and preserves them into raw claim bridge', () => {
  const normalized = normalizeMemoryCandidatesPacket(buildPacket([
    {
      id: 'cand-3',
      kind: 'fact',
      text: 'Гарфилду после ветеринара все еще нужен курс лечения.',
      normalizedText: 'Гарфилду после ветеринара все еще нужен курс лечения.',
      confidence: 0.9,
      semantic: {
        class: 'medical_state',
        subclass: 'treatment',
        key: 'garfield_treatment',
        category: 'veterinary_care',
        tags: ['medical', 'treatment']
      },
      references: {
        subject: {
          ref: 'core_character:active',
          role: 'core_character',
          label: 'Ху Тао',
          confidence: 0.7
        },
        object: {
          ref: 'core_user:main',
          role: 'core_user',
          label: 'пользователь',
          confidence: 0.4
        },
        about: [
          {
            ref: 'entity:garfield',
            role: 'entity',
            label: 'Гарфилд',
            confidence: 0.95
          }
        ]
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
        tense: 'ongoing',
        anchorText: null,
        resolvedAt: null,
        isRecurring: false,
        recurrenceHint: null
      },
      memory: {
        durability: 'episodic',
        salience: 0.9,
        stability: 0.82,
        memoryRelevance: 0.9,
        sensitivity: 'medium',
        confirmationStatus: 'single_shot'
      },
      source: {
        extractor: 'llm',
        model: 'gpt-5.2',
        promptVersion: 'llm_memory_candidates_v1',
        sourceEventId: 'evt-1',
        timestamp: '2026-04-14T12:00:00.000Z'
      }
    }
  ]))

  const postprocessed = postprocessLlmCandidates(normalized)
  const candidate = postprocessed.candidates[0]
  const rawClaim = candidateToRawClaim(candidate, {
    id: 'evt-1',
    timestamp: '2026-04-14T12:00:00.000Z'
  })

  assert.equal(candidate.references.subject.ref, 'entity:garfield')
  assert.equal(candidate.references.object.ref, 'core_user:main')
  assert.equal(rawClaim.payload.references.subject.ref, 'entity:garfield')
})

test('interpret pipeline uses repaired claim references as canonical override', () => {
  const resolved = resolveClaimRefs({
    payload: {
      references: {
        subject: {
          ref: 'entity:garfield',
          role: 'entity',
          label: 'Гарфилд',
          confidence: 0.95
        },
        object: {
          ref: null,
          role: 'unknown',
          label: null,
          confidence: 0
        }
      }
    }
  }, {
    coreUserRef: 'core_user:main',
    coreCharacterRef: 'core_character:active'
  })

  assert.equal(resolved.subjectRef, 'entity:garfield')
  assert.equal(resolved.objectRef, null)
})

test('drops weak self-directed focus mistyped as instruction', () => {
  const normalized = normalizeMemoryCandidatesPacket(buildPacket([
    {
      id: 'cand-4',
      kind: 'instruction',
      text: 'Мне сейчас нужно просто внимательно слушать ветеринара и запоминать.',
      normalizedText: 'Мне сейчас нужно просто внимательно слушать ветеринара и запоминать.',
      confidence: 0.68,
      semantic: {
        class: 'task_focus',
        subclass: 'self_instruction',
        key: 'temporary_focus',
        category: 'temporary_task',
        tags: ['focus']
      },
      references: {
        subject: {
          ref: 'core_user:main',
          role: 'core_user',
          label: 'пользователь',
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
        durability: 'transient',
        salience: 0.42,
        stability: 0.3,
        memoryRelevance: 0.4,
        sensitivity: 'low',
        confirmationStatus: 'single_shot'
      },
      source: {
        extractor: 'llm',
        model: 'gpt-5.2',
        promptVersion: 'llm_memory_candidates_v1',
        sourceEventId: 'evt-1',
        timestamp: '2026-04-14T12:00:00.000Z'
      }
    }
  ]))

  const result = postprocessLlmCandidates(normalized)

  assert.equal(result.candidates.length, 0)
})
