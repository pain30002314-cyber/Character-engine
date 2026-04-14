'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')

const BUILD_MEMORY_RE = /хочу[\s\S]*построить[\s\S]*сильн(ую|ая|ое)\s+памят/i
const MAKE_SYSTEM_RE = /хочу[\s\S]*построить[\s\S]*сильн(ую|ая|ое)\s+систем/i
const KEEP_REAL_RE = /хочу[\s\S]*чтобы[\s\S]*осталась\s+живой/i
const RELATIONSHIP_GOAL_RE = /мне\s+нужна\s+ты\s+настоящая/i

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function buildGoalCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  payload
}) {
  const actor = actorRef(context.actorRole)

  return makeCandidate({
    type: 'goal',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'goal.regex',
      rule
    },
    actor,
    about: [actor],
    confidence,
    certainty: 'high',
    dedupeKeyHint: `goal::${subtype}::speaker::${text.toLowerCase()}`,
    payload
  })
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const lowered = clause.clauseNormalizedText
  const results = []

  if (!text || context.isQuestion) return results

  if (BUILD_MEMORY_RE.test(lowered)) {
    results.push(
      buildGoalCandidate({
        subtype: 'project_goal',
        text,
        clause,
        context,
        rule: 'build_memory_goal_v1',
        confidence: 0.92,
        payload: {
          goalText: text,
          goalDomain: 'project',
          timeHorizon: 'long_term'
        }
      })
    )
  }

  if (MAKE_SYSTEM_RE.test(lowered)) {
    results.push(
      buildGoalCandidate({
        subtype: 'project_goal',
        text,
        clause,
        context,
        rule: 'build_system_goal_v1',
        confidence: 0.88,
        payload: {
          goalText: text,
          goalDomain: 'project',
          timeHorizon: 'long_term'
        }
      })
    )
  }

  if (KEEP_REAL_RE.test(lowered) || RELATIONSHIP_GOAL_RE.test(lowered)) {
    results.push(
      buildGoalCandidate({
        subtype: 'relationship_goal',
        text,
        clause,
        context,
        rule: 'keep_real_goal_v1',
        confidence: 0.84,
        payload: {
          goalText: text,
          goalDomain: 'relationship',
          timeHorizon: 'long_term'
        }
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