'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function includesAny(text, needles) {
  const source = String(text || '').toLowerCase()
  return needles.some((needle) => source.includes(String(needle).toLowerCase()))
}

function inferPreferenceTopic(text) {
  const source = String(text || '').toLowerCase()

  if (source.includes('патч')) return 'patches'
  if (source.includes('файл')) return 'file_format'
  if (source.includes('объясн')) return 'explanation_style'
  if (source.includes('план')) return 'planning'
  if (source.includes('хаос') || source.includes('хаотич')) return 'orderliness'
  if (source.includes('интересн')) return 'novelty'
  if (source.includes('скуч')) return 'novelty'
  if (source.includes('незаверш')) return 'openness'

  return 'general'
}

function inferPreferenceContext(text) {
  const source = String(text || '').toLowerCase()

  if (
    includesAny(source, [
      'патч',
      'файл',
      'объясн',
      'план'
    ])
  ) {
    return 'workflow'
  }

  return 'general'
}

function buildPreferenceCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  polarity = null
}) {
  const actor = actorRef(context.actorRole)
  const topic = inferPreferenceTopic(text)
  const preferenceContext = inferPreferenceContext(text)

  return makeCandidate({
    type: 'preference',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'preference.regex',
      rule
    },
    actor,
    about: [actor],
    confidence,
    polarity,
    dedupeKeyHint: `preference::${subtype}::speaker::${text.toLowerCase()}`,
    payload: {
      topic,
      context: preferenceContext,
      preference: subtype
    }
  })
}

function isFalsePreference(text, context) {
  const source = String(text || '').toLowerCase()

  if (context.isQuestion) return true
  if (/многие\s+предпочитают/i.test(source)) return true

  if (
    /для\s+логов/i.test(source) ||
    /оценить\s+ваши\s+способности/i.test(source) ||
    /пройдите\s+тест/i.test(source) ||
    /поговорить\s+для\s+начала/i.test(source) ||
    /вдаваться\s+в\s+подробности/i.test(source) ||
    /скидок\s+и\s+чеков/i.test(source) ||
    /каждый\s+день\s+слышать/i.test(source) ||
    /отвечать\s+на\s+звонки/i.test(source) ||
    /чем\s+потом\s+буду\s+искать/i.test(source) ||
    /так\s+что\s+давай\s+лучше/i.test(source)
  ) {
    return true
  }

  return false
}

function isOperationalNeed(text) {
  const source = String(text || '').toLowerCase()

  if (!source) return false

  return (
    /(^|[^а-яёa-z0-9_])нужно\s+(немного\s+)?поговорить[\s\S]*(для\s+лог|для\s+начала|для\s+теста)/i.test(source) ||
    /(^|[^а-яёa-z0-9_])нужно\s+оценить[\s\S]*способност/i.test(source) ||
    /(^|[^а-яёa-z0-9_])нужно\s+пройти\s+тест/i.test(source) ||
    /(^|[^а-яёa-z0-9_])нужно[\s\S]*(для\s+лог|для\s+теста|для\s+начала|проверить|оценить|записать)/i.test(source) ||
    /не\s+нужно\s+было/i.test(source) ||
    /нужен\s+был/i.test(source) ||
    /нужна\s+была/i.test(source) ||
    /нужно\s+было/i.test(source)
  )
}

function isHypotheticalPreference(text, context) {
  const source = String(text || '').toLowerCase()

  if (context.isConditional || context.isHypothetical) return true

  return (
    /представляю[\s\S]*мне\s+скучно/i.test(source) ||
    /а\s+что\s+если/i.test(source) ||
    /вот\s+тогда\s+я\s+может\s+быть/i.test(source)
  )
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const lowered = clause.clauseNormalizedText
  const results = []

  if (!text || isFalsePreference(text, context)) return results

  if (/не\s+люблю/i.test(lowered)) {
    results.push(
      buildPreferenceCandidate({
        subtype: 'dislike',
        text,
        clause,
        context,
        rule: 'dislike_v1',
        confidence: 0.88,
        polarity: 'negative'
      })
    )
  }

  if (
    /предпочитаю\s+/i.test(lowered) ||
    /^я\s+бы\s+лучше\s+/i.test(lowered) ||
    /^лучше\s+бы\s+/i.test(lowered)
  ) {
    results.push(
      buildPreferenceCandidate({
        subtype: 'prefer',
        text,
        clause,
        context,
        rule: 'prefer_v2',
        confidence: 0.84
      })
    )
  }

  if (/давай\s+без\s+/i.test(lowered)) {
    results.push(
      buildPreferenceCandidate({
        subtype: 'avoid',
        text,
        clause,
        context,
        rule: 'avoid_v1',
        confidence: 0.85,
        polarity: 'negative'
      })
    )
  }

  if (
    /^мне\s+нужно\s+/i.test(lowered) ||
    /^мне\s+нужна\s+/i.test(lowered) ||
    /^мне\s+нужен\s+/i.test(lowered)
  ) {
    results.push(
      buildPreferenceCandidate({
        subtype: 'need',
        text,
        clause,
        context,
        rule: 'need_v2',
        confidence: 0.86
      })
    )
  }

  if (/так\s+интереснее/i.test(lowered)) {
    results.push(
      buildPreferenceCandidate({
        subtype: 'like',
        text,
        clause,
        context,
        rule: 'like_interesting_v1',
        confidence: 0.76,
        polarity: 'positive'
      })
    )
  }

  if (/скучно/i.test(lowered) && !isHypotheticalPreference(text, context)) {
    results.push(
      buildPreferenceCandidate({
        subtype: 'dislike',
        text,
        clause,
        context,
        rule: 'dislike_boring_v1',
        confidence: 0.76,
        polarity: 'negative'
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
