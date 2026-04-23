'use strict'

const { getNowIso } = require('../utils/time')
const {
  buildMergedCandidateId,
  getImportanceRank,
  mergeCompatiblePayloads,
  safeArray,
  uniq
} = require('./helpers')

function pickPrimaryCandidate(group) {
  return [...group].sort((left, right) => {
    const importanceDelta = getImportanceRank(right.importance) - getImportanceRank(left.importance)
    if (importanceDelta !== 0) return importanceDelta

    const summaryDelta = String(right.summary || '').length - String(left.summary || '').length
    if (summaryDelta !== 0) return summaryDelta

    return String(right.text || '').length - String(left.text || '').length
  })[0]
}

function mergeDuplicateGroup(group = []) {
  const list = safeArray(group)
  if (!list.length) {
    return null
  }

  const primary = pickPrimaryCandidate(list)
  const sourceCandidateIds = uniq(list.map((item) => item.candidateId || item.id))
  const sourcePasses = uniq(list.map((item) => item.sourcePass))
  const tags = uniq(list.flatMap((item) => safeArray(item.tags)))
  const flags = uniq([
    ...list.flatMap((item) => safeArray(item.flags)),
    'merged_duplicate_group'
  ])

  let payload = {}
  for (const candidate of list) {
    const mergedPayload = mergeCompatiblePayloads(payload, candidate.payload || {})
    payload = mergedPayload || payload
  }

  const mergedCandidateId = buildMergedCandidateId(primary.kind, sourceCandidateIds)

  return {
    ...primary,
    id: mergedCandidateId,
    candidateId: mergedCandidateId,
    text: primary.text,
    summary: primary.summary,
    importance: [...list]
      .sort((left, right) => getImportanceRank(right.importance) - getImportanceRank(left.importance))[0]
      ?.importance || primary.importance,
    tags,
    normalizedTags: tags,
    semantic: {
      ...(primary.semantic || {}),
      tags
    },
    payload,
    sourcePasses,
    sourceCandidateIds,
    mergedFrom: sourceCandidateIds,
    originalTexts: uniq(list.map((item) => item.text)),
    originalImportances: uniq(list.map((item) => item.importance)),
    relatedCandidateIds: [],
    relationToRelated: [],
    flags,
    createdAt: getNowIso()
  }
}

module.exports = {
  mergeDuplicateGroup
}
