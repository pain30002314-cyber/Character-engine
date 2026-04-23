'use strict'

const {
  arePayloadsCompatible,
  isTextVeryClose,
  safeArray
} = require('./helpers')

function areSummariesCompatible(left, right) {
  if (!left || !right) return true
  return isTextVeryClose(left, right)
}

function areSafeDuplicates(left, right) {
  if (!left || !right) return false
  if (left.candidateId === right.candidateId) return false
  if (left.kind !== right.kind) return false
  if (left.eventId && right.eventId && left.eventId !== right.eventId) return false

  if (!isTextVeryClose(left.text, right.text)) {
    return false
  }

  if (!areSummariesCompatible(left.summary, right.summary)) {
    return false
  }

  if (!arePayloadsCompatible(left.payload, right.payload)) {
    return false
  }

  return true
}

function groupDuplicateCandidates(candidates = []) {
  const list = safeArray(candidates)
  const visited = new Set()
  const duplicateGroups = []
  const duplicatePairKeys = new Set()

  for (let index = 0; index < list.length; index += 1) {
    if (visited.has(index)) continue

    const base = list[index]
    const group = [base]

    for (let innerIndex = index + 1; innerIndex < list.length; innerIndex += 1) {
      if (visited.has(innerIndex)) continue

      const candidate = list[innerIndex]
      if (!areSafeDuplicates(base, candidate)) continue

      group.push(candidate)
      duplicatePairKeys.add([base.candidateId, candidate.candidateId].sort().join('::'))
      visited.add(innerIndex)
    }

    if (group.length > 1) {
      visited.add(index)
      duplicateGroups.push(group)
    }
  }

  return {
    duplicateGroups,
    duplicatePairKeys: Array.from(duplicatePairKeys)
  }
}

module.exports = {
  groupDuplicateCandidates
}
