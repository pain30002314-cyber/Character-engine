'use strict'

const {
  arePayloadsCompatible,
  buildPairKey,
  isTextVeryClose,
  safeArray
} = require('./helpers')

function findConflicts({
  candidates = [],
  duplicatePairKeys = []
}) {
  const list = safeArray(candidates)
  const duplicatePairs = new Set(duplicatePairKeys)
  const conflicts = []

  for (let index = 0; index < list.length; index += 1) {
    for (let innerIndex = index + 1; innerIndex < list.length; innerIndex += 1) {
      const left = list[index]
      const right = list[innerIndex]
      const pairKey = buildPairKey(left.candidateId, right.candidateId)

      if (duplicatePairs.has(pairKey)) {
        continue
      }

      if (left.kind !== right.kind) {
        continue
      }

      if (
        !isTextVeryClose(left.text, right.text) &&
        !isTextVeryClose(left.summary, right.summary)
      ) {
        continue
      }

      if (arePayloadsCompatible(left.payload, right.payload)) {
        continue
      }

      conflicts.push({
        leftCandidateId: left.candidateId,
        rightCandidateId: right.candidateId,
        relation: 'conflicts_with',
        pairKey
      })
    }
  }

  return conflicts
}

module.exports = {
  findConflicts
}
