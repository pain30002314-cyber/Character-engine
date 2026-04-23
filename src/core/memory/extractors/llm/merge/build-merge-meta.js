'use strict'

function buildMergeMeta({
  totalInputCandidates = 0,
  totalOutputCandidates = 0,
  duplicateGroups = [],
  overlaps = [],
  conflicts = [],
  configuredPasses = [],
  passResults = [],
  failedPasses = []
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
    overlapGroups: overlaps.length,
    conflictGroups: conflicts.length,
    missingPasses,
    warnings
  }
}

module.exports = {
  buildMergeMeta
}
