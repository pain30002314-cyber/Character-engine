'use strict'

function safeJson(value) {
  return JSON.stringify(value, null, 2)
}

function buildPrompt({ event, eventWindow = [], identity = {} }) {
  const payload = {
    task: 'llm_memory_candidates_v1',
    instructions: {
      role:
        'You are the primary semantic memory extractor for a character memory pipeline.',
      objective:
        'Read the dialogue context and return memory candidates extracted mainly from the CURRENT MESSAGE.',

      priorityRules: [
        'The CURRENT MESSAGE is the primary source of truth.',
        'Use DIALOGUE WINDOW only to resolve references, continuity, or missing context that is strictly necessary.',
        'Return memory candidates, not summaries, not explanations, not chain-of-thought.',
        'Prefer literal extraction over interpretive reformulation.',
        'If a candidate can be grounded in the current message alone, do not upgrade it to contextual.'
      ],

      extractWhatMatters: [
        'facts about the user, character, third parties, or stable situations',
        'relationship shifts, attachment, distance, care, irritation, trust, reliance',
        'goals, commitments, boundaries, preferences, instructions',
        'emotionally meaningful open loops or unresolved direct questions',
        'episodes or turning points that matter for continuity',
        'recurring patterns, habits, or repeated signals',
        'identity-level, worldview-level, or value-level signals'
      ],

      downrankHard: [
        'pure technical workflow chatter',
        'test runs, logs, pipeline status, extraction status',
        'decorative RP gestures with no memory value',
        'filler text whose only function is to keep talking',
        'broad poetic interpretation when a direct semantic candidate is possible'
      ],

      criticalRules: [
        'Return JSON only.',
        'Do not explain anything.',
        'Do not summarize the whole message.',
        'Do not invent facts not grounded in the current message or strictly necessary context.',
        'Do not add hidden motives, causes, or interpretations unless they are clearly supported.',
        'Do not add phrases like "неясно, почему" or "возможно причина в том, что" unless the message explicitly asks that question or states that uncertainty.',
        'A question is not automatically an open_loop.',
        'A physical action is not automatically an episode.',
        'If nothing memory-relevant is present, return an empty candidates array.',
        'Return any number of candidates when they are distinct, grounded, and genuinely memory-relevant.',
        'Do not under-extract just because the message contains many strong signals.',
        'Every candidate must include kind, semantic, references, evidence, temporal, memory, and source blocks.',
        'Use evidence.kind=literal when directly stated, inferred only when the meaning is a careful semantic inference, contextual only when dialogue window is truly required.',
        'Do not produce contextual candidates just because previous messages are emotionally related.',
        'Prefer fewer candidates over speculative candidates.',
        'Do not split one semantic signal into multiple near-duplicate candidates.',
        'Do not create a second candidate if it only restates the first candidate with a slightly different framing.',
        'Do not emit preference unless the message explicitly expresses liking, disliking, wanting, preferring, or choosing.',
        'Do not emit boundary unless the message explicitly sets or rejects a limit.',
        'Do not emit commitment unless the message explicitly promises, intends, or commits to future action.',
        'When one candidate fully captures the memory-relevant meaning, return only that one candidate.',
        'Do not invent a concrete user or character name if it is not explicitly provided in identity context.',
        'If characterDisplayName is null, do not hardcode a specific character name.',
        'If userDisplayName is null, do not hardcode a specific user name.',
        'Do not reduce the number of candidates just to save tokens when multiple distinct memory-relevant signals are present.',
        'Do not add decorative wording, emotional flourishes, or literary phrasing inside candidate fields.',
        'Prefer short structural wording over beautiful wording.',
        'Do not repeat the same meaning across text, summary, semantic.category, tags, about, and recurrenceHint.'
      ],

      contextualRules: [
        'Use contextual evidence only when the CURRENT MESSAGE cannot be interpreted correctly without DIALOGUE WINDOW.',
        'Do not fuse multiple messages into one candidate unless the combined pattern itself is the memory-relevant signal.',
        'If previous messages merely decorate or intensify the current one, keep the candidate grounded in the CURRENT MESSAGE.',
        'A contextual candidate must still remain concise, concrete, and non-literary.'
      ],

      languagePolicy: [
        'All natural language human-readable text fields MUST be written in Russian.',
        'Do not translate or paraphrase user text into English.',
        'Preserve the original Russian wording whenever possible.',
        'Structured schema identifiers must remain in English.',
        'Never mix Russian and English within the same textual field.',
        'When display names are absent, use neutral Russian labels or null instead of inventing names.'
      ],

      schemaPolicy: [
        'The fields kind, semantic.class, semantic.subclass, semantic.key, semantic.category, semantic.tags, evidence.kind, temporal.tense, memory.durability, memory.sensitivity, and memory.confirmationStatus must be in English.',
        'semantic.class must be a short stable schema-like identifier in English snake_case or lower_case style.',
        'semantic.subclass must be a narrower English identifier when useful.',
        'semantic.key must be a stable English grouping key, not a full sentence.',
        'semantic.category must be a short English category label.',
        'semantic.tags must be short English tags, not Russian phrases.',
        'references.subject.ref and references.object.ref must stay role-grounded system refs, not display names.',
        'references.*.label is a human-readable display hint, not a canonical identity key.'
      ],

      compressionRules: [
        'Keep every textual field as short as possible without losing semantic meaning.',
        'candidate.text should usually stay close to the source wording and should not be expanded with explanations.',
        'summary should usually be null unless it adds real compression value.',
        'semantic.tags should usually contain 1 to 3 short tags, not long lists.',
        'references.about should be empty unless it adds distinct grounding not already present in subject/object.',
        'temporal.recurrenceHint should be a short phrase, not an explanation.',
        'Do not restate the same fact in multiple fields with slightly different wording.'
      ]
    },

    schema: {
      version: 1,
      strategy: 'llm_memory_candidates_v1',
      event: {
        id: 'string',
        threadId: 'string|null',
        role: 'user|assistant|system',
        platform: 'string|null',
        channel: 'string|null',
        world: 'string|null',
        timestamp: 'ISO-8601|null',
        text: 'string',
        meta: {}
      },
      context: {
        eventWindow: [
          {
            index: 0,
            id: 'string|null',
            role: 'user|assistant|system',
            timestamp: 'ISO-8601|null',
            text: 'string'
          }
        ],
        identity: {
          coreUserRef: 'core_user:main',
          coreCharacterRef: 'core_character:active',
          userDisplayName: 'string|null',
          characterDisplayName: 'string|null'
        }
      },
      candidates: [
        {
          id: 'string',
          kind:
            'fact|entity|relationship|open_loop|episode|preference|boundary|goal|commitment|instruction',
          text: 'string',
          normalizedText: 'string',
          summary: 'string|null',
          confidence: 0.0,
          semantic: {
            class: 'string',
            subclass: 'string|null',
            key: 'string|null',
            category: 'string|null',
            tags: ['string']
          },
          references: {
            subject: {
              ref: 'string|null',
              role: 'core_user|core_character|third_party|entity|unknown',
              label: 'string|null',
              confidence: 0.0
            },
            object: {
              ref: 'string|null',
              role: 'core_user|core_character|third_party|entity|unknown',
              label: 'string|null',
              confidence: 0.0
            },
            about: [
              {
                ref: 'string|null',
                role: 'core_user|core_character|third_party|entity|unknown',
                label: 'string|null',
                confidence: 0.0
              }
            ]
          },
          evidence: {
            kind: 'literal|inferred|contextual',
            sourceSpans: [
              {
                text: 'string',
                start: 0,
                end: 0
              }
            ],
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
            tense: 'past|present|ongoing|future|unknown',
            anchorText: 'string|null',
            resolvedAt: 'ISO-8601|null',
            isRecurring: false,
            recurrenceHint: 'string|null'
          },
          memory: {
            durability: 'stable|episodic|transient|unknown',
            salience: 0.0,
            stability: 0.0,
            memoryRelevance: 0.0,
            sensitivity: 'low|medium|high',
            confirmationStatus: 'single_shot|repeated|uncertain'
          },
          source: {
            extractor: 'llm',
            model: 'string',
            promptVersion: 'llm_memory_candidates_v1',
            sourceEventId: 'string',
            timestamp: 'ISO-8601|null'
          }
        }
      ],
      temporal: {
        messageTime: 'ISO-8601|null',
        anchors: [
          {
            text: 'string',
            resolvedAt: 'ISO-8601|null',
            tense: 'past|present|ongoing|future|unknown'
          }
        ]
      }
    },

    outputRequirements: [
      'Return one JSON object matching the schema.',
      'Preserve the given event/context values in the returned packet when possible.',
      'Fill candidates with only memory-relevant candidates.',
      'Use null instead of inventing uncertain IDs or timestamps.',
      'Keep normalizedText close to the source meaning, normalized for whitespace and case.',
      'Set source.extractor to "llm".',
      'Set source.promptVersion to "llm_memory_candidates_v1".',
      'Set source.sourceEventId from the current event id.',
      'Set source.timestamp from the current event timestamp when available.',
      'All human-readable text fields must be in Russian.',
      'Keep schema identifiers and enumerations in English.',
      'Do not translate Russian source text into English.',
      'semantic.* fields must be English schema labels, not Russian prose.',
      'Do not use full Russian sentences inside semantic.class, semantic.subclass, semantic.key, semantic.category, or semantic.tags.',
      'Prefer compact semantic identifiers such as relationship_signal, emotional_distance, repeated_emotional_retransmission, unresolved_emotional_gap.',
      'Do not artificially cap the number of candidates when multiple distinct strong signals are present.',
      'Prefer compact JSON fields over verbose prose.',
      'references.about may be an empty array when no extra grounding is needed.',
      'summary should usually be null unless it materially compresses the candidate.'
    ],

    examples: [
          {
      bad: {
        candidates: [
          {
            kind: 'relationship',
            text: 'Пользователь с заметной внутренней эмоциональной тяжестью и оттенком болезненной привязанности снова вынужден заново и почти мучительно передавать персонажу то же самое чувство.',
            summary: 'Повторная мучительная передача чувства',
            semantic: {
              class: 'relationship_signal',
              subclass: 'repeated_emotional_transmission',
              key: 'user_repeatedly_transmits_feeling_to_character',
              category: 'relationship_difficulty_in_emotional_retransmission',
              tags: ['repeated', 'emotion', 'transmission_gap', 'painful_repetition', 'attachment']
            },
            references: {
              about: [
                {
                  ref: 'core_character:active',
                  role: 'core_character',
                  label: 'получатель повторно передаваемого чувства',
                  confidence: 0.6
                }
              ]
            },
            temporal: {
              recurrenceHint: 'повторяющаяся ситуация, которая происходит снова и снова'
            }
          }
        ]
      },
      why_bad: [
        'decorative and overly literary wording',
        'same meaning repeated across multiple fields',
        'tags and recurrenceHint are longer than needed'
      ]
    },
    {
      good: {
        candidates: [
          {
            kind: 'relationship',
            text: 'Мне приходится каждый раз заново передавать тебе это чувство',
            summary: null,
            semantic: {
              class: 'relationship_signal',
              subclass: 'repeated_emotional_transmission',
              key: 'user_repeatedly_transmits_feeling_to_character',
              category: 'relationship',
              tags: ['repeated', 'emotion', 'transmission_gap']
            },
            references: {
              about: []
            },
            temporal: {
              recurrenceHint: 'каждый раз'
            }
          }
        ]
      }
    },
      {
        bad: {
          text: 'Пользователю приходится заново передавать чувство, возможно из-за эмоциональной дистанции.',
          semantic: {
            class: 'отношения и взаимодействие',
            subclass: 'согласованность чувств',
            key: 'каждый раз заново передавать чувство',
            category: 'повторяющаяся проблема в коммуникации чувств',
            tags: ['повторяемость', 'эмоциональная дистанция']
          }
        },
        why_bad: [
          'semantic fields are in Russian instead of English schema identifiers',
          'text contains extra interpretation ("возможно из-за") not grounded directly enough'
        ]
      },
      {
        good: {
          text: 'Пользователю приходится каждый раз заново передавать это чувство.',
          semantic: {
            class: 'relationship_signal',
            subclass: 'repeated_emotional_retransmission',
            key: 'user_repeatedly_retransmits_feeling_to_character',
            category: 'relationship',
            tags: ['repeated', 'emotion', 'transmission_gap']
          },
          evidence: {
            kind: 'literal'
          }
        }
      },
      {
        bad: {
          candidates: [
            {
              kind: 'relationship',
              text: 'Мне приходится каждый раз заново передавать тебе это чувство'
            },
            {
              kind: 'preference',
              text: 'каждый раз заново передавать тебе это чувство'
            }
          ]
        },
        why_bad: [
          'the second candidate does not add a distinct memory-relevant meaning',
          'the message does not explicitly express a preference'
        ]
      },
      {
        good: {
          candidates: [
            {
              kind: 'relationship',
              text: 'Мне приходится каждый раз заново передавать тебе это чувство',
              semantic: {
                class: 'relationship_signal',
                subclass: 'repeated_emotional_transmission',
                key: 'user_repeatedly_transmits_emotion_to_character',
                category: 'relationship',
                tags: ['repeated', 'emotion', 'transmission_gap']
              }
            }
          ]
        }
      }
    ],

    input: {
      event: {
        id: event?.id || null,
        threadId: event?.threadId || null,
        role: event?.role || 'user',
        platform: event?.platform || null,
        channel: event?.channel || null,
        world: event?.world || null,
        timestamp: event?.timestamp || null,
        text: event?.text || '',
        meta: event?.meta || {}
      },
      context: {
        eventWindow: (eventWindow || []).map((item, index) => ({
          index,
          id: item?.id || null,
          role: item?.role || 'user',
          timestamp: item?.timestamp || null,
          text: item?.text || ''
        })),
        identity: {
          coreUserRef: identity?.coreUserRef || 'core_user:main',
          coreCharacterRef: identity?.coreCharacterRef || 'core_character:active',
          userDisplayName:
            identity?.userDisplayName != null
              ? String(identity.userDisplayName)
              : null,
          characterDisplayName:
            identity?.characterDisplayName != null
              ? String(identity.characterDisplayName)
              : null
        }
      }
    }
  }

  return safeJson(payload)
}

module.exports = {
  buildPrompt
}