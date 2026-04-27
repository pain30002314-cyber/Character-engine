'use strict'

const { getNowIso } = require('../utils/time')
const { buildMergeMeta } = require('./build-merge-meta')
const { groupDuplicateCandidates } = require('./find-duplicates')
const { findOverlaps } = require('./find-overlaps')
const { findConflicts } = require('./find-conflicts')
const { mergeDuplicateGroup } = require('./merge-duplicate-group')
const { safeArray, uniq } = require('./helpers')

function attachRelation(candidate, relationEntry, relatedCandidateId) {
  if (!candidate || !relatedCandidateId || candidate.candidateId === relatedCandidateId) {
    return candidate
  }

  const relation = relationEntry?.relation || 'related_to'
  const relatedCandidateIds = Array.isArray(candidate.relatedCandidateIds)
    ? [...candidate.relatedCandidateIds]
    : []
  const relationToRelated = Array.isArray(candidate.relationToRelated)
    ? [...candidate.relationToRelated]
    : []

  if (!relatedCandidateIds.includes(relatedCandidateId)) {
    relatedCandidateIds.push(relatedCandidateId)
  }

  if (!relationToRelated.some((item) => item?.candidateId === relatedCandidateId && item?.relation === relation)) {
    relationToRelated.push({
      candidateId: relatedCandidateId,
      relation,
      reason: relationEntry?.reason || null,
      score: relationEntry?.score ?? null
    })
  }

  const flags = Array.isArray(candidate.flags) ? [...candidate.flags] : []

  if (relation === 'overlaps_with') {
    flags.push('overlap_detected')
  }

  if (relation === 'conflicts_with') {
    flags.push('conflict_detected', 'unresolved_conflict')
  }

  return {
    ...candidate,
    relatedCandidateIds,
    relationToRelated,
    flags: Array.from(new Set(flags))
  }
}

function buildMergeActionsPreview(overlaps = [], conflicts = []) {
  const overlapActions = safeArray(overlaps).map((group) => ({
    action: 'link_overlap',
    candidateIds: safeArray(group?.candidateIds),
    reason: group?.reason || null,
    score: group?.score ?? null
  }))

  const conflictActions = safeArray(conflicts).map((group) => ({
    action: 'link_conflict',
    candidateIds: [group?.leftCandidateId, group?.rightCandidateId].filter(Boolean),
    relation: group?.relation || 'conflicts_with'
  }))

  return [...overlapActions, ...conflictActions]
}

function ensureStandaloneCandidate(candidate) {
  const sourceCandidateId = candidate?.candidateId || candidate?.id || null
  const sourcePass = candidate?.sourcePass || null

  return {
    ...candidate,
    sourcePasses: uniq([...(safeArray(candidate?.sourcePasses)), sourcePass]),
    sourceCandidateIds: uniq([...(safeArray(candidate?.sourceCandidateIds)), sourceCandidateId]),
    mergedFrom: uniq([...(safeArray(candidate?.mergedFrom)), sourceCandidateId]),
    relatedCandidateIds: safeArray(candidate?.relatedCandidateIds),
    relationToRelated: safeArray(candidate?.relationToRelated),
    createdAt: candidate?.createdAt || getNowIso()
  }
}

function mergePassResults({
  traceId = null,
  eventId = null,
  threadId = null,
  passResults = [],
  configuredPasses = [],
  failedPasses = []
}) {
  const flattenedCandidates = safeArray(passResults).flatMap((passResult) =>
    safeArray(passResult?.candidates)
  )

  const { duplicateGroups, duplicatePairKeys } = groupDuplicateCandidates(flattenedCandidates)
  const mergedCandidates = []
  const consumedCandidateIds = new Set()

  for (const group of duplicateGroups) {
    const merged = mergeDuplicateGroup(group)
    if (!merged) continue

    mergedCandidates.push(merged)
    for (const candidate of group) {
      consumedCandidateIds.add(candidate.candidateId)
    }
  }

  const standaloneCandidates = flattenedCandidates
    .filter((candidate) => !consumedCandidateIds.has(candidate.candidateId))
    .map(ensureStandaloneCandidate)

  const outputCandidates = [...mergedCandidates, ...standaloneCandidates]
  const inputToOutputId = new Map()

  for (const candidate of standaloneCandidates) {
    inputToOutputId.set(candidate.candidateId, candidate.candidateId)
  }

  for (const mergedCandidate of mergedCandidates) {
    for (const sourceCandidateId of safeArray(mergedCandidate.sourceCandidateIds)) {
      inputToOutputId.set(sourceCandidateId, mergedCandidate.candidateId)
    }
  }

  const overlaps = findOverlaps({
    candidates: flattenedCandidates,
    duplicatePairKeys
  })

  const conflicts = findConflicts({
    candidates: flattenedCandidates,
    duplicatePairKeys
  })

  const outputById = new Map(outputCandidates.map((candidate) => [candidate.candidateId, candidate]))

  for (const overlap of overlaps) {
    const candidateIds = safeArray(overlap?.candidateIds)

    for (let index = 0; index < candidateIds.length; index += 1) {
      for (let innerIndex = index + 1; innerIndex < candidateIds.length; innerIndex += 1) {
        const leftOutputId = inputToOutputId.get(candidateIds[index])
        const rightOutputId = inputToOutputId.get(candidateIds[innerIndex])

        if (!leftOutputId || !rightOutputId || leftOutputId === rightOutputId) {
          continue
        }

        outputById.set(
          leftOutputId,
          attachRelation(outputById.get(leftOutputId), overlap, rightOutputId)
        )
        outputById.set(
          rightOutputId,
          attachRelation(outputById.get(rightOutputId), overlap, leftOutputId)
        )
      }
    }
  }

  for (const relation of conflicts) {
    const leftOutputId = inputToOutputId.get(relation.leftCandidateId)
    const rightOutputId = inputToOutputId.get(relation.rightCandidateId)

    if (!leftOutputId || !rightOutputId || leftOutputId === rightOutputId) {
      continue
    }

    outputById.set(
      leftOutputId,
      attachRelation(outputById.get(leftOutputId), relation, rightOutputId)
    )
    outputById.set(
      rightOutputId,
      attachRelation(outputById.get(rightOutputId), relation, leftOutputId)
    )
  }

  const candidates = Array.from(outputById.values())
  const mergeMeta = buildMergeMeta({
    totalInputCandidates: flattenedCandidates.length,
    totalOutputCandidates: candidates.length,
    duplicateGroups,
    overlaps,
    conflicts,
    configuredPasses,
    passResults,
    failedPasses,
    mergeActions: buildMergeActionsPreview(overlaps, conflicts)
  })

  return {
    traceId: traceId || passResults?.[0]?.traceId || null,
    eventId: eventId || passResults?.[0]?.eventId || null,
    threadId: threadId || passResults?.[0]?.threadId || null,
    candidates,
    mergeMeta
  }
}

module.exports = {
  mergePassResults
}
