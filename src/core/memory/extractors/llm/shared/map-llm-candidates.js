'use strict'

const { toSafeKey } = require('../utils/text')

function mapLlmCandidates(candidates = []) {
  return (Array.isArray(candidates) ? candidates : []).map((candidate) => ({
    kind: toSafeKey(candidate.kind, 'signal'),
    text: candidate.text,
    summary: candidate.summary,
    importance: candidate.importance,
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    payload:
      candidate.payload && typeof candidate.payload === 'object'
        ? candidate.payload
        : {},
    rawKind: candidate?.raw?.kind != null ? String(candidate.raw.kind) : candidate.kind,
    rawImportance:
      candidate?.raw?.importance != null ? String(candidate.raw.importance) : candidate.importance,
    rawTags: Array.isArray(candidate?.raw?.tags) ? candidate.raw.tags : candidate.tags || [],
    rawPayload:
      candidate?.raw?.payload && typeof candidate.raw.payload === 'object'
        ? candidate.raw.payload
        : candidate.payload || {},
    confidence: null,
    confidenceScore: null,
    flags: [],
    semantic: {
      class: null,
      subclass: null,
      key: null,
      category: null,
      tags: Array.isArray(candidate.tags) ? candidate.tags : []
    },
    memory: null,
    references: null,
    evidence: null,
    temporal: null
  }))
}

module.exports = {
  mapLlmCandidates
}
