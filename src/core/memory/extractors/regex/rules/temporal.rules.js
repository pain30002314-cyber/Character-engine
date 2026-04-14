'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildTemporalCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  payload = {}
}) {
  return makeCandidate({
    type: 'temporal',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'temporal.regex',
      rule
    },
    confidence,
    dedupeKeyHint: `temporal::${subtype}::${text.toLowerCase()}`,
    payload
  })
}

function hasDirtyPrefix(source) {
  return (
    /(^|[^а-яёa-z0-9_])(бляяя|бля|еблан|господи)([^а-яёa-z0-9_]|$)/i.test(source) ||
    /^ху\s+тао[, ]/i.test(source)
  )
}

function looksDuration(source) {
  return /(^|[^а-яёa-z0-9_])\d+\s+(день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев|час|часа|часов)([^а-яёa-z0-9_]|$)/i.test(source)
}

function looksCleanDurationClause(source) {
  if (!looksDuration(source)) return false
  if (hasDirtyPrefix(source)) return false
  if (source.length > 120) return false
  return true
}

function looksAnchorNow(source) {
  return /(^|[^а-яёa-z0-9_])(сейчас|прямо\s+сейчас|сегодня|сегодня\s+утром|сегодня\s+днем|сегодня\s+днём|сегодня\s+вечером|сегодня\s+ночью|вчера|вчера\s+утром|вчера\s+вечером)([^а-яёa-z0-9_]|$)/i.test(source)
}

function isWeakOperationalNow(source) {
  return (
    /видимо,\s*сейчас/i.test(source) ||
    /мне\s+кажется[\s\S]*сейчас/i.test(source) ||
    /сейчас\s+пойдем\s+в\s+слои/i.test(source) ||
    /сейчас\s+пойдем\s+выше/i.test(source) ||
    /к\s+сожалению\s+сейчас/i.test(source) ||
    /пока\s+сейчас/i.test(source) ||
    /на\s+данном\s+этапе\s+сейчас/i.test(source) ||
    /сейчас[\s\S]*(лог|логи|экстрактор|regex|llm|mem0|снапшот|мердж|pipeline|пайплайн)/i.test(source)
  )
}

function detectOne({ clause, context }) {
  const text = clause?.clauseText || ''
  const source = normalize(text)
  const results = []

  if (!text) return results
  if (context.isQuestion) return results

  if (looksCleanDurationClause(source)) {
    results.push(
      buildTemporalCandidate({
        subtype: 'duration',
        text,
        clause,
        context,
        rule: 'clean_duration_v3',
        confidence: 0.84,
        payload: {
          temporalKind: 'duration'
        }
      })
    )
  }

  if (
    looksAnchorNow(source) &&
    source.length <= 160 &&
    !isWeakOperationalNow(source)
  ) {
    results.push(
      buildTemporalCandidate({
        subtype: 'anchor_now',
        text,
        clause,
        context,
        rule: 'anchor_now_v3',  
        confidence: 0.78,
        payload: {
          temporalKind: 'anchor_now'
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