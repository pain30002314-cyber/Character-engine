'use strict'

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

function parseSemanticTagsPatch(rawText) {
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

function applySemanticTagsPatch(packet, patch) {
  const source = packet && typeof packet === 'object' ? packet : {}
  const candidates = safeArray(source?.candidates)
  const updates = safeArray(patch?.tagUpdates)

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

      const nextFlags = safeArray(candidate?.flags).filter(
        (flag) => flag !== 'invalid_semantic_tags'
      )

      return {
        ...candidate,
        flags: nextFlags,
        semantic: {
          ...(candidate?.semantic || {}),
          tags: patchedTags
        }
      }
    })
  }
}

module.exports = {
  sanitizeTag,
  sanitizeTagList,
  parseSemanticTagsPatch,
  applySemanticTagsPatch
}