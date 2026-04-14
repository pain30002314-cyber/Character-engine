'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')

const TOPIC_FOR_NOW_RE = /пока\s+не\s+хочу[\s\S]*эту\s+тем/i
const DONT_TOUCH_TOPIC_RE = /пока[\s\S]*не\s+трога(ем|й)/i
const WITHOUT_RE = /давай\s+без[\s\S]*/i
const NOT_NOW_RE = /не\s+сейчас|сейчас\s+не\s+хочу/i
const SCOPE_LIMIT_RE = /только[\s\S]*(это|regex|экстрактор)/i

function buildBoundaryCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  payload
}) {
  return makeCandidate({
    type: 'boundary',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'boundary.regex',
      rule
    },
    confidence,
    dedupeKeyHint: `boundary::${subtype}::${text.toLowerCase()}`,
    payload
  })
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const lowered = clause.clauseNormalizedText
  const results = []

  if (!text) return results

  if (TOPIC_FOR_NOW_RE.test(lowered) || DONT_TOUCH_TOPIC_RE.test(lowered) || NOT_NOW_RE.test(lowered)) {
    results.push(
      buildBoundaryCandidate({
        subtype: 'topic_boundary',
        text,
        clause,
        context,
        rule: 'topic_boundary_v2',
        confidence: 0.9,
        payload: {
          boundaryText: text,
          boundaryScope: 'topic',
          temporary: true,
          timeHint: 'for_now'
        }
      })
    )
  }

  if (WITHOUT_RE.test(lowered)) {
    results.push(
      buildBoundaryCandidate({
        subtype: 'scope_boundary',
        text,
        clause,
        context,
        rule: 'scope_boundary_without_v1',
        confidence: 0.84,
        payload: {
          boundaryText: text,
          boundaryScope: 'scope',
          temporary: false
        }
      })
    )
  }

  if (SCOPE_LIMIT_RE.test(lowered)) {
    results.push(
      buildBoundaryCandidate({
        subtype: 'scope_boundary',
        text,
        clause,
        context,
        rule: 'scope_boundary_only_v1',
        confidence: 0.8,
        payload: {
          boundaryText: text,
          boundaryScope: 'scope',
          temporary: false
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