'use strict'

const {
  buildPairKey,
  isTextClose,
  isTextVeryClose,
  safeArray
} = require('./helpers')

function findOverlaps({
  candidates = [],
  duplicatePairKeys = []
}) {
  const list = safeArray(candidates)
  const duplicatePairs = new Set(duplicatePairKeys)
  const overlaps = []

  for (let index = 0; index < list.length; index += 1) {
    for (let innerIndex = index + 1; innerIndex < list.length; innerIndex += 1) {
      const left = list[index]
      const right = list[innerIndex]
      const pairKey = buildPairKey(left.candidateId, right.candidateId)

      if (duplicatePairs.has(pairKey)) {
        continue
      }

      if (left.kind === right.kind) {
        continue
      }

      if (isTextVeryClose(left.text, right.text) || isTextVeryClose(left.summary, right.summary)) {
        overlaps.push({
          leftCandidateId: left.candidateId,
          rightCandidateId: right.candidateId,
          relation: 'overlaps_with',
          pairKey
        })
        continue
      }

      if (isTextClose(left.text, right.text) || isTextClose(left.summary, right.summary)) {
        overlaps.push({
          leftCandidateId: left.candidateId,
          rightCandidateId: right.candidateId,
          relation: 'possible_same_origin',
          pairKey
        })
      }
    }
  }

  return overlaps
}

module.exports = {
  findOverlaps
}
