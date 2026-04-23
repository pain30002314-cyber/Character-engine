'use strict'

const { getNowIso } = require('../utils/time')
const { buildMergeMeta } = require('./build-merge-meta')
const { groupDuplicateCandidates } = require('./find-duplicates')
const { findOverlaps } = require('./find-overlaps')
const { findConflicts } = require('./find-conflicts')
const { mergeDuplicateGroup } = require('./merge-duplicate-group')
const { safeArray, uniq } = require('./helpers')

function attachRelation(candidate, relation, relatedCandidateId) {
  if (!candidate || !relatedCandidateId || candidate.candidateId === relatedCandidateId) {
    return candidate
  }

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
      relation
    })
  }

  const flags = Array.isArray(candidate.flags) ? [...candidate.flags] : []

  if (relation === 'overlaps_with' || relation === 'possible_same_origin') {
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

  for (const relation of [...overlaps, ...conflicts]) {
    const leftOutputId = inputToOutputId.get(relation.leftCandidateId)
    const rightOutputId = inputToOutputId.get(relation.rightCandidateId)

    if (!leftOutputId || !rightOutputId || leftOutputId === rightOutputId) {
      continue
    }

    outputById.set(
      leftOutputId,
      attachRelation(outputById.get(leftOutputId), relation.relation, rightOutputId)
    )
    outputById.set(
      rightOutputId,
      attachRelation(outputById.get(rightOutputId), relation.relation, leftOutputId)
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
    failedPasses
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
