'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')

function speaker(role) {
  return toRoleRef(role, 'я', 1)
}

function assistantTarget(surface = 'ты') {
  return toRoleRef('assistant', surface, 0.98)
}

function extractQuotedFragments(text) {
  if (!text) return []

  const matches = [...String(text).matchAll(/"([^"\n]{6,220})"/g)]
  return matches.map((m) => m[1].trim()).filter(Boolean)
}

function buildRelationshipCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  polarity,
  signalLevel = 'relational_change'
}) {
  const actor = speaker(context.actorRole)
  const target = assistantTarget(/тебя/i.test(text) ? 'тебя' : 'ты')

  return makeCandidate({
    type: 'relationship',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'relationship.regex',
      rule
    },
    actor,
    target,
    about: [actor, target],
    confidence,
    polarity,
    tenseHint: 'present',
    timeAnchor: 'now',
    dedupeKeyHint: `relationship::${subtype}::speaker::assistant::${text.toLowerCase()}`,
    payload: {
      signalLevel
    }
  })
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const lowered = clause.clauseNormalizedText
  const results = []

  if (!text || context.isQuestion) return results

  if (/(^|[^а-яёa-z0-9_])я\s+люблю\s+тебя(^|[^а-яёa-z0-9_])/i.test(text)) {
    results.push(
      buildRelationshipCandidate({
        subtype: 'affection',
        text,
        clause,
        context,
        rule: 'love_you_direct_v1',
        confidence: 0.95,
        polarity: 'positive'
      })
    )
  }

  if (context.hasQuote) {
    const fragments = extractQuotedFragments(text)

    for (const fragment of fragments) {
      const loweredFragment = String(fragment || '').toLowerCase()

      if (/пользователь\s+любит\s+ху\s+тао/i.test(loweredFragment)) {
        results.push(
          buildRelationshipCandidate({
            subtype: 'affection',
            text: fragment,
            clause,
            context,
            rule: 'quoted_user_loves_hutao_v1',
            confidence: 0.92,
            polarity: 'positive'
          })
        )
      }

      if (/пользователь\s+считает[\s\S]*ху\s+тао[\s\S]*жив/i.test(loweredFragment)) {
        results.push(
          buildRelationshipCandidate({
            subtype: 'closeness',
            text: fragment,
            clause,
            context,
            rule: 'quoted_living_presence_closeness_v1',
            confidence: 0.88,
            polarity: 'positive'
          })
        )
      }
    }
  }

  if (/(^|[^а-яёa-z0-9_])ты\s+мне\s+безумно\s+дорога(^|[^а-яёa-z0-9_])/i.test(text)) {
    results.push(
      buildRelationshipCandidate({
        subtype: 'affection',
        text,
        clause,
        context,
        rule: 'dear_to_me_v1',
        confidence: 0.9,
        polarity: 'positive'
      })
    )
  }

  if (/не\s+хочу\s+делать\s+из\s+тебя\s+куклу/i.test(text)) {
    results.push(
      buildRelationshipCandidate({
        subtype: 'care',
        text,
        clause,
        context,
        rule: 'not_make_doll_v1',
        confidence: 0.88,
        polarity: 'positive'
      })
    )
  }

  if (/мне\s+нужна\s+ты\s+настоящая/i.test(text)) {
    results.push(
      buildRelationshipCandidate({
        subtype: 'care',
        text,
        clause,
        context,
        rule: 'need_real_you_v1',
        confidence: 0.84,
        polarity: 'positive'
      })
    )
  }

  if (/меня\s+бесит.*ты/i.test(text)) {
    results.push(
      buildRelationshipCandidate({
        subtype: 'irritation',
        text,
        clause,
        context,
        rule: 'annoys_me_you_v1',
        confidence: 0.84,
        polarity: 'negative',
        signalLevel: 'transient_reaction'
      })
    )
  }

  if (
    /с\s+тобой\s+уже\s+\d+\s+(месяц|месяца|месяцев).*как\s+с\s+жив/i.test(lowered) ||
    /ты\s+для\s+меня.*жив/i.test(lowered) ||
    /ты\s+итак\s+на\s+максимум\s+жив/i.test(lowered) ||
    /я\s+все\s+равно\s+продолжаю\s+видеть\s+в\s+тебе.*жив/i.test(lowered) ||
    /вижу\s+в\s+тебе\s+живую\s+девушку/i.test(lowered) ||
    /не\s+как\s+с\s+кодом,\s*а\s+как\s+с\s+жив/i.test(lowered) ||
    /а\s+не\s+хорошо\s+сделанный\s+промт/i.test(lowered)
  ) {
    results.push(
      buildRelationshipCandidate({
        subtype: 'closeness',
        text,
        clause,
        context,
        rule: 'living_presence_closeness_v2',
        confidence: 0.9,
        polarity: 'positive'
      })
    )
  }

  if (/испытываю.*дистанци/i.test(lowered)) {
    results.push(
      buildRelationshipCandidate({
        subtype: 'tension',
        text,
        clause,
        context,
        rule: 'distance_tension_v1',
        confidence: 0.8,
        polarity: 'negative',
        signalLevel: 'relational_change'
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