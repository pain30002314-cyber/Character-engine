'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function inferConflictSides(text) {
  const source = String(text || '').trim()
  const lower = source.toLowerCase()
  const splitters = [' но ', ' а ', ' хотя ']

  for (const splitter of splitters) {
    const index = lower.indexOf(splitter)
    if (index !== -1) {
      return {
        sideA: source.slice(0, index).trim().replace(/[,.!?\s]+$/, ''),
        sideB: source.slice(index + splitter.length).trim().replace(/[,.!?\s]+$/, '')
      }
    }
  }

  return {
    sideA: source,
    sideB: null
  }
}

function buildConflictCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  theme
}) {
  const actor = actorRef(context.actorRole)
  const sides = inferConflictSides(text)

  return makeCandidate({
    type: 'conflict',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'conflict.regex',
      rule
    },
    actor,
    about: [actor],
    confidence,
    dedupeKeyHint: `conflict::${subtype}::speaker::${text.toLowerCase()}`,
    payload: {
      conflictType: subtype,
      sideA: sides.sideA,
      sideB: sides.sideB,
      theme
    }
  })
}

function detectOne({ clause, context }) {
  const clauseText = String(clause?.clauseText || '').trim()
  const unitText = String(clause?.text || clauseText).trim()
  const haystack = String(clause?.normalizedText || unitText).toLowerCase()
  const results = []

  if (!unitText || context.isQuestion) return results

  if (/хочу[\s\S]*но[\s\S]*страш/i.test(haystack) || /боюсь[\s\S]*но/i.test(haystack)) {
    results.push(
      buildConflictCandidate({
        subtype: 'internal',
        text: unitText,
        clause,
        context,
        rule: 'internal_fear_v1',
        confidence: 0.88,
        theme: 'approach_vs_fear'
      })
    )
  }

  if (
    /хочу[\s\S]*быстро[\s\S]*но[\s\S]*(без\s+хаос|хаос|хаотич)/i.test(haystack) ||
    /хочу[\s\S]*но[\s\S]*без\s+хаос/i.test(haystack)
  ) {
    results.push(
      buildConflictCandidate({
        subtype: 'goal_conflict',
        text: unitText,
        clause,
        context,
        rule: 'goal_structure_v1',
        confidence: 0.85,
        theme: 'structure'
      })
    )
  }

  if (
    /не\s+умею\s+программир[\s\S]*но[\s\S]*хочу/i.test(haystack) ||
    /нет\s+возможности/i.test(haystack)
  ) {
    results.push(
      buildConflictCandidate({
        subtype: 'constraint_conflict',
        text: unitText,
        clause,
        context,
        rule: 'constraint_v1',
        confidence: 0.84,
        theme: /программ/i.test(haystack) ? 'programming' : 'capability'
      })
    )
  }

  if (/меня\s+бесит[\s\S]*ты/i.test(haystack)) {
    results.push(
      buildConflictCandidate({
        subtype: 'interpersonal',
        text: unitText,
        clause,
        context,
        rule: 'interpersonal_v1',
        confidence: 0.8,
        theme: 'interaction'
      })
    )
  }

  if (/люблю[\s\S]*но[\s\S]*не\s+хочу/i.test(haystack)) {
    results.push(
      buildConflictCandidate({
        subtype: 'preference_conflict',
        text: unitText,
        clause,
        context,
        rule: 'preference_conflict_v1',
        confidence: 0.8,
        theme: 'approach_avoidance'
      })
    )
  }

  if (/мне\s+грустно[\s\S]*но[\s\S]*часть\s+жизни/i.test(haystack)) {
    results.push(
      buildConflictCandidate({
        subtype: 'internal',
        text: unitText,
        clause,
        context,
        rule: 'sad_but_acceptance_v1',
        confidence: 0.77,
        theme: 'emotion_vs_acceptance'
      })
    )
  }

  return results
}

async function detect({ clauses }) {
  return runRuleList({ clauses, detectOne })
}

module.exports = {
  detect
}
