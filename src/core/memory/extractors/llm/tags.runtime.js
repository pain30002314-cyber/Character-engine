'use strict'

const env = require('../../../../config/env')
const { generateRawCompletion } = require('../../../../services/llm.service')

const TAG_MODEL =
  env.MEMORY_MODEL ||
  env.MODEL ||
  'openai/gpt-5.4-nano'

const VALID_TAG_RE = /^[a-z][a-z0-9_]{0,63}$/

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function sanitizeTag(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return VALID_TAG_RE.test(normalized) ? normalized : null
}

function sanitizeTagList(tags) {
  return Array.from(new Set(
    safeArray(tags)
      .map((item) => sanitizeTag(item))
      .filter(Boolean)
  )).slice(0, 3)
}

function buildSemanticTagsPatchPrompt({ event, candidates }) {
  return JSON.stringify({
    task: 'semantic_tags_patch_v1',
    instructions: {
      role: 'You are a schema tag formatter for extracted semantic memory candidates.',
      objective: 'Return only English semantic tag patches for already extracted candidates.',
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
      candidates: safeArray(candidates).map((candidate) => ({
        id: candidate?.id || null,
        kind: candidate?.kind || null,
        text: candidate?.text || '',
        semantic: {
          class: candidate?.semantic?.class || null,
          subclass: candidate?.semantic?.subclass || null,
          key: candidate?.semantic?.key || null,
          category: candidate?.semantic?.category || null,
          tags: safeArray(candidate?.semantic?.tags)
        }
      }))
    }
  })
}

function parseTagsPatch(rawText) {
  if (!rawText) {
    return { tagUpdates: [] }
  }

  try {
    const parsed = JSON.parse(rawText)
    const rawUpdates = safeArray(parsed?.tagUpdates)

    return {
      tagUpdates: rawUpdates
        .map((item) => ({
          candidateId: String(item?.candidateId || '').trim(),
          semanticTags: sanitizeTagList(item?.semanticTags)
        }))
        .filter((item) => item.candidateId)
    }
  } catch {
    return { tagUpdates: [] }
  }
}

async function runSemanticTagsPatch({ event, candidates }) {
  const safeCandidates = safeArray(candidates)
  if (!safeCandidates.length) {
    return {
      model: TAG_MODEL,
      raw: '',
      patch: { tagUpdates: [] }
    }
  }

  const prompt = buildSemanticTagsPatchPrompt({
    event,
    candidates: safeCandidates
  })

  const response = await generateRawCompletion({
    prompt,
    model: TAG_MODEL
  })

  const raw =
    response?.text ||
    response?.content ||
    response?.output_text ||
    ''

  return {
    model: response?.model || TAG_MODEL,
    raw,
    patch: parseTagsPatch(raw)
  }
}

function applySemanticTagsPatch(packet, patchResult) {
  const source = packet && typeof packet === 'object' ? packet : {}
  const candidates = safeArray(source?.candidates)
  const updates = safeArray(patchResult?.patch?.tagUpdates)

  if (!candidates.length || !updates.length) {
    return source
  }

  const byId = new Map(
    updates.map((item) => [item.candidateId, sanitizeTagList(item.semanticTags)])
  )

  return {
    ...source,
    candidates: candidates.map((candidate) => {
      const patchedTags = byId.get(candidate?.id)
      if (!patchedTags) {
        return candidate
      }

      return {
        ...candidate,
        semantic: {
          ...(candidate?.semantic || {}),
          tags: patchedTags
        }
      }
    }),
    debug: {
      ...(source?.debug || {}),
      semanticTagsPatch: {
        model: patchResult?.model || TAG_MODEL,
        updatesApplied: updates.length
      }
    }
  }
}

module.exports = {
  buildSemanticTagsPatchPrompt,
  runSemanticTagsPatch,
  applySemanticTagsPatch
}