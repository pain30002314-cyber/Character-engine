'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')
const { phraseRegex } = require('../core/regex')

const SELF_NAME_RE = /(^|[^а-яёa-z0-9_])меня\s+зовут\s+([A-ZА-ЯЁ][a-zа-яё-]+)([^а-яёa-z0-9_]|$)/i
const PROGRAMMING_ZERO_RE = /я\s+ноль\s+в\s+программирован/i
const CAFE_MANAGER_RE = /я\s+управля(ющий|ющая)\s+кафе/i
const CLEAR_PLAN_RE = /я\s+люблю\s+четк(ий|ую|ое)\s+план/i
const OPEN_BOOK_RE = /я\s+всегда\s+перед\s+людьми\s+как\s+открытая\s+книга/i
const SIMPLE_TRAIT_RE = /(^|[^а-яёa-z0-9_])я\s+(тревожный|тревожная|странный|странная)([^а-яёa-z0-9_]|$)/i
const ALIVE_TRAIT_RE = phraseRegex('я просто живая')

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function buildIdentityCandidate({
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
    type: 'identity',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'identity.regex',
      rule
    },
    actor,
    about: [actor],
    confidence,
    dedupeKeyHint: `identity::${subtype}::speaker::${text.toLowerCase()}`,
    payload
  })
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const lowered = clause.clauseNormalizedText
  const results = []

  if (!text || context.isQuestion) return results

  const nameMatch = text.match(SELF_NAME_RE)
  if (nameMatch) {
    const value = nameMatch[2]
    results.push(
      buildIdentityCandidate({
        subtype: 'display_name',
        text,
        clause,
        context,
        rule: 'self_name_v1',
        confidence: 0.96,
        payload: {
          dimension: 'display_name',
          value,
          normalizedValue: value.toLowerCase()
        }
      })
    )
  }

  if (/запомнила[\s\S]*как\s+меня\s+зовут\?\s*[A-ZА-ЯЁ][a-zа-яё-]+\.\s*$/i.test(text)) {
    const fallback = text.match(/([A-ZА-ЯЁ][a-zа-яё-]+)\.\s*$/)
    if (fallback) {
      const value = fallback[1]
      results.push(
        buildIdentityCandidate({
          subtype: 'display_name',
          text: `Меня зовут ${value}`,
          clause,
          context,
          rule: 'self_name_contextual_tail_v1',
          confidence: 0.9,
          payload: {
            dimension: 'display_name',
            value,
            normalizedValue: value.toLowerCase()
          }
        })
      )
    }
  }

  if (PROGRAMMING_ZERO_RE.test(lowered)) {
    results.push(
      buildIdentityCandidate({
        subtype: 'competence_view',
        text,
        clause,
        context,
        rule: 'competence_zero_programming_v1',
        confidence: 0.88,
        payload: {
          dimension: 'competence_view',
          polarity: 'negative',
          value: text
        }
      })
    )
  }

  if (CAFE_MANAGER_RE.test(lowered)) {
    results.push(
      buildIdentityCandidate({
        subtype: 'role',
        text,
        clause,
        context,
        rule: 'role_cafe_manager_v1',
        confidence: 0.9,
        payload: {
          dimension: 'role',
          value: text
        }
      })
    )
  }

  if (CLEAR_PLAN_RE.test(lowered)) {
    results.push(
      buildIdentityCandidate({
        subtype: 'style',
        text,
        clause,
        context,
        rule: 'style_clear_plan_v1',
        confidence: 0.8,
        payload: {
          dimension: 'style',
          value: text
        }
      })
    )
  }

  if (OPEN_BOOK_RE.test(lowered)) {
    results.push(
      buildIdentityCandidate({
        subtype: 'self_view',
        text,
        clause,
        context,
        rule: 'self_view_open_book_v1',
        confidence: 0.84,
        payload: {
          dimension: 'self_view',
          value: text
        }
      })
    )
  }

  if (SIMPLE_TRAIT_RE.test(text) || ALIVE_TRAIT_RE.test(lowered)) {
    results.push(
      buildIdentityCandidate({
        subtype: 'trait',
        text,
        clause,
        context,
        rule: 'trait_simple_v1',
        confidence: 0.82,
        payload: {
          dimension: 'trait',
          value: text
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