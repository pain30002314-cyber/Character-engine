'use strict'

function buildSemanticTagsPatchPrompt({ event, candidates = [] }) {
  return JSON.stringify({
    task: 'semantic_tags_patch_v1',
    instructions: {
      role: 'You are a semantic tag formatter for already extracted candidates.',
      objective: 'Return only English semantic tag patches for the provided candidates.',
      criticalRules: [
        'Return JSON only.',
        'Do not rewrite candidate meaning.',
        'Do not add, remove, merge, or split candidates.',
        'Do not change kind, text, refs, evidence, temporal, memory, class, subclass, key, or category.',
        'Return only tagUpdates.',
        'Use candidateId exactly as provided.',
        'semanticTags must contain 0 to 3 short English schema tags.',
        'Use lower_case or snake_case only.',
        'Do not output Russian words.',
        'Do not output full phrases or explanations.',
        'If no good tags are available, return an empty array for that candidate.'
      ],
      examples: [
        {
          bad: {
            candidateId: 'c1',
            semanticTags: ['готово', 'оценка', 'работа']
          },
          good: {
            candidateId: 'c1',
            semanticTags: ['patch', 'evaluation', 'request']
          }
        },
        {
          bad: {
            candidateId: 'c2',
            semanticTags: ['после_патча']
          },
          good: {
            candidateId: 'c2',
            semanticTags: ['post_patch']
          }
        }
      ]
    },
    schema: {
      tagUpdates: [
        {
          candidateId: 'string',
          semanticTags: ['string']
        }
      ]
    },
    input: {
      event: {
        id: event?.id || null,
        text: event?.text || ''
      },
      candidates: (candidates || []).map((candidate) => ({
        id: candidate?.id || null,
        kind: candidate?.kind || null,
        text: candidate?.text || '',
        semantic: {
          class: candidate?.semantic?.class || null,
          subclass: candidate?.semantic?.subclass || null,
          key: candidate?.semantic?.key || null,
          category: candidate?.semantic?.category || null,
          tags: Array.isArray(candidate?.semantic?.tags) ? candidate.semantic.tags : []
        }
      }))
    }
  })
}

module.exports = {
  buildSemanticTagsPatchPrompt
}