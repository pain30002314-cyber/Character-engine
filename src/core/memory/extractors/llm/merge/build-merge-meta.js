'use strict'

const { safeArray, uniq } = require('./helpers')

function buildDuplicateGroupPreview(duplicateGroups = []) {
  return safeArray(duplicateGroups)
    .slice(0, 10)
    .map((group, index) => ({
      groupId: `duplicate:${index + 1}`,
      candidateIds: safeArray(group).map((candidate) => candidate?.candidateId).filter(Boolean),
      kinds: uniq(safeArray(group).map((candidate) => candidate?.kind).filter(Boolean)),
      sourcePasses: uniq(safeArray(group).map((candidate) => candidate?.sourcePass).filter(Boolean)),
      summaries: safeArray(group).map((candidate) => candidate?.summary).filter(Boolean).slice(0, 3)
    }))
}

function buildConflictGroupPreview(conflicts = []) {
  return safeArray(conflicts)
    .slice(0, 10)
    .map((conflict, index) => ({
      groupId: conflict?.pairKey || `conflict:${index + 1}`,
      relation: conflict?.relation || 'conflicts_with',
      candidateIds: [conflict?.leftCandidateId, conflict?.rightCandidateId].filter(Boolean)
    }))
}

function buildMergeMeta({
  totalInputCandidates = 0,
  totalOutputCandidates = 0,
  duplicateGroups = [],
  overlaps = [],
  conflicts = [],
  configuredPasses = [],
  passResults = [],
  failedPasses = [],
  mergeActions = []
}) {
  const successfulPassKeys = new Set(
    (Array.isArray(passResults) ? passResults : [])
      .map((item) => item?.sourcePass || item?.extractorKey || null)
      .filter(Boolean)
  )

  const failedPassKeys = new Set(
    (Array.isArray(failedPasses) ? failedPasses : [])
      .map((item) => item?.extractorKey || null)
      .filter(Boolean)
  )

  const missingPasses = (Array.isArray(configuredPasses) ? configuredPasses : [])
    .map((item) => item?.extractorKey || null)
    .filter((key) => key && !successfulPassKeys.has(key))

  const warnings = []

  if (missingPasses.length > 0 || failedPassKeys.size > 0) {
    warnings.push('partial_pass_set')
  }

  return {
    totalInputCandidates,
    totalOutputCandidates,
    duplicateGroups: duplicateGroups.length,
    duplicateGroupPreview: buildDuplicateGroupPreview(duplicateGroups),
    overlapGroups: overlaps.length,
    overlapGroupPreview: safeArray(overlaps).slice(0, 10),
    conflictGroups: conflicts.length,
    conflictGroupPreview: buildConflictGroupPreview(conflicts),
    mergeActionsPreview: safeArray(mergeActions).slice(0, 10),
    missingPasses,
    warnings
  }
}

module.exports = {
  buildMergeMeta
}
