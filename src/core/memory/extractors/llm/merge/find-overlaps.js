'use strict'

const { normalizeForOverlap } = require('../utils/text')
const { buildPairKey, safeArray, uniq } = require('./helpers')

const OVERLAP_THRESHOLD = 0.45

function toWordSet(value) {
  return new Set(safeArray(value).filter(Boolean))
}

function jaccardScore(leftWords, rightWords) {
  const left = toWordSet(leftWords)
  const right = toWordSet(rightWords)

  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let intersection = 0

  for (const word of left) {
    if (right.has(word)) {
      intersection += 1
    }
  }

  const union = left.size + right.size - intersection
  return union > 0 ? intersection / union : 0
}

function intersectWords(leftWords, rightWords) {
  const right = toWordSet(rightWords)
  return uniq(safeArray(leftWords).filter((word) => right.has(word)))
}

function normalizeTags(tags) {
  return uniq(
    safeArray(tags)
      .flatMap((tag) => normalizeForOverlap(tag).words)
      .filter(Boolean)
  )
}

function hasContainment(leftText, rightText) {
  if (!leftText || !rightText) {
    return false
  }

  return leftText.includes(rightText) || rightText.includes(leftText)
}

function buildReasonBucket(reasons) {
  const reasonSet = new Set(reasons)
  const hasText = reasonSet.has('text_containment') || reasonSet.has('text_jaccard')
  const hasSummary = reasonSet.has('summary_jaccard')
  const hasTags = reasonSet.has('shared_tags')

  if ((hasText && hasSummary) || (hasText && hasTags) || (hasSummary && hasTags)) {
    return 'mixed_overlap'
  }

  if (hasText) {
    return 'text_overlap'
  }

  if (hasSummary) {
    return 'summary_overlap'
  }

  if (hasTags) {
    return 'tag_overlap'
  }

  return 'mixed_overlap'
}

function scoreCandidateOverlap(left, right) {
  const reasons = []
  const textLeft = normalizeForOverlap(left?.text)
  const textRight = normalizeForOverlap(right?.text)
  const summaryLeft = normalizeForOverlap(left?.summary)
  const summaryRight = normalizeForOverlap(right?.summary)
  const tagsLeft = normalizeTags(left?.tags)
  const tagsRight = normalizeTags(right?.tags)

  const textContainment = hasContainment(textLeft.text, textRight.text)
  const textJaccard = jaccardScore(textLeft.words, textRight.words)
  const summaryJaccard = jaccardScore(summaryLeft.words, summaryRight.words)
  const sharedTags = intersectWords(tagsLeft, tagsRight)
  const sharedTextWords = intersectWords(textLeft.words, textRight.words)
  const sharedSummaryWords = intersectWords(summaryLeft.words, summaryRight.words)

  let score = 0

  if (textContainment) {
    score += 0.55
    reasons.push('text_containment')
  }

  if (textJaccard >= 0.35) {
    score += 0.45
    reasons.push('text_jaccard')
  }

  if (summaryJaccard >= 0.3) {
    score += 0.35
    reasons.push('summary_jaccard')
  }

  if (sharedTags.length >= 2) {
    score += 0.35
    reasons.push('shared_tags')
  } else if (sharedTags.length >= 1) {
    score += 0.2
    reasons.push('shared_tag')
  }

  const sameOrigin = (
    (left?.eventId && right?.eventId && left.eventId === right.eventId) ||
    (
      normalizeForOverlap(left?.sourceText).text &&
      normalizeForOverlap(left?.sourceText).text === normalizeForOverlap(right?.sourceText).text
    )
  )

  const hasSupportOverlap =
    textContainment ||
    textJaccard >= 0.35 ||
    summaryJaccard >= 0.3 ||
    sharedTags.length >= 1 ||
    sharedTextWords.length >= 1 ||
    sharedSummaryWords.length >= 1

  if (sameOrigin && hasSupportOverlap) {
    score += 0.1
    reasons.push('same_origin')
  }

  if (left?.sourcePass && right?.sourcePass && left.sourcePass === right.sourcePass) {
    score -= 0.2
    reasons.push('same_source_pass')
  }

  if (left?.kind === right?.kind) {
    score -= 0.4
    reasons.push('same_kind')
  }

  return {
    isOverlap: left?.kind !== right?.kind && score >= OVERLAP_THRESHOLD,
    score: Number(score.toFixed(2)),
    reasons,
    detail: {
      textContainment,
      textJaccard: Number(textJaccard.toFixed(2)),
      summaryJaccard: Number(summaryJaccard.toFixed(2)),
      sharedTags,
      sharedTextWords,
      sharedSummaryWords,
      sameOrigin
    }
  }
}

function buildOverlapGroup(left, right, pairKey, scoring) {
  const reason = buildReasonBucket(scoring.reasons)

  return {
    groupId: `overlap:${pairKey}`,
    pairKey,
    relation: 'overlaps_with',
    reason,
    score: scoring.score,
    candidateIds: [left.candidateId, right.candidateId],
    kinds: uniq([left.kind, right.kind]),
    sourcePasses: uniq([left.sourcePass, right.sourcePass]),
    summaries: [left.summary, right.summary].filter(Boolean),
    reasons: scoring.reasons,
    detail: scoring.detail
  }
}

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

      const scoring = scoreCandidateOverlap(left, right)

      if (!scoring.isOverlap) {
        continue
      }

      overlaps.push(buildOverlapGroup(left, right, pairKey, scoring))
    }
  }

  return overlaps
}

module.exports = {
  normalizeForOverlap,
  scoreCandidateOverlap,
  findOverlaps
}
