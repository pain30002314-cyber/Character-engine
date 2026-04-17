'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')

const ENTITY_DEFS = [
  {
    patterns: [
      /(^|[^а-яёa-z0-9_])андрей([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])андрея([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])андрею([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])андреем([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_andrey_v5',
    confidence: 0.9
  },
  {
    subtype: 'character',
    value: 'Ху Тао',
    patterns: [
      /ху\s+тао/i,
      /хутао/i
    ],
    rule: 'entity_hutao_v5',
    confidence: 0.9
  },
  {
    subtype: 'pet',
    value: 'Гарфилд',
    patterns: [
      /(^|[^а-яёa-z0-9_])гарфилд([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])гарфилда([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])гарфилду([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])гарфилдом([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])гарфилде([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_garfield_v1',
    confidence: 0.92
  },
  {
    subtype: 'pet',
    value: 'Семка',
    patterns: [
      /(^|[^а-яёa-z0-9_])семка([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])семки([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])семке([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])семку([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])семкой([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])семен([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_semka_v1',
    confidence: 0.9
  },
  {
    subtype: 'pet',
    value: 'Дымок',
    patterns: [
      /(^|[^а-яёa-z0-9_])дымок([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])дымка([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])дымку([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])дымком([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])дымке([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_dymok_v1',
    confidence: 0.9
  },
  {
    subtype: 'pet',
    value: 'Чумуска',
    patterns: [
      /(^|[^а-яёa-z0-9_])чумуска([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])чумуски([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])чумуске([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])чумуску([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])чумуской([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_chumuska_v1',
    confidence: 0.9
  },
  {
    subtype: 'person',
    value: 'Иваныч',
    patterns: [
      /(^|[^а-яёa-z0-9_])иваныч([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_ivanych_v1',
    confidence: 0.88
  },
  {
    subtype: 'person',
    value: 'Инна',
    patterns: [
      /(^|[^а-яёa-z0-9_])инна([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_inna_v1',
    confidence: 0.88
  },
  {
    subtype: 'person',
    value: 'Айгунь',
    patterns: [
      /(^|[^а-яёa-z0-9_])айгунь([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_aigun_v1',
    confidence: 0.88
  },
  {
    subtype: 'person',
    value: 'Кристина',
    patterns: [
      /(^|[^а-яёa-z0-9_])кристина([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_kristina_v1',
    confidence: 0.88
  },
  {
    subtype: 'person',
    value: 'Милена',
    patterns: [
      /(^|[^а-яёa-z0-9_])милена([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_milena_v1',
    confidence: 0.88
  },
  {
    subtype: 'person',
    value: 'Юля',
    patterns: [
      /(^|[^а-яёa-z0-9_])юля([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_yulya_v1',
    confidence: 0.88
  },
  {
    subtype: 'person',
    value: 'Настя',
    patterns: [
      /(^|[^а-яёa-z0-9_])настя([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_nastya_v1',
    confidence: 0.88
  },
  {
    subtype: 'person',
    value: 'Брат',
    patterns: [
      /(^|[^а-яёa-z0-9_])брат([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_brat_v1',
    confidence: 0.72,
    extraGuard: isLikelyRealBrotherContext
  },
  {
    subtype: 'place',
    value: 'ресторан',
    patterns: [
      /(^|[^а-яёa-z0-9_])ресторанчик([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])ресторан([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])ресторане([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])кафе([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])заведение([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])заведении([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_restaurant_v1',
    confidence: 0.8,
    extraGuard: isLikelyOwnedVenueContext
  },
  {
    subtype: 'place',
    value: 'кофейня',
    patterns: [
      /(^|[^а-яёa-z0-9_])кофейня([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])кофейне([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_coffee_shop_v1',
    confidence: 0.82
  },
  {
    subtype: 'project',
    value: 'Мостик',
    patterns: [
      /(^|[^а-яёa-z0-9_])мостик([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])мостика([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])мостику([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_mostik_v1',
    confidence: 0.86
  },
  {
    subtype: 'system',
    value: 'chatgpt',
    patterns: [
      /(^|[^а-яёa-z0-9_])chatgpt([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])chat\s*gpt([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])чат\s*гпт([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])чатгпт([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_chatgpt_v4',
    confidence: 0.84
  },
  {
    subtype: 'system',
    value: 'телеграм',
    patterns: [
      /(^|[^а-яёa-z0-9_])telegram([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])телеграм([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])телега([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])телегу([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])тг([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_telegram_v1',
    confidence: 0.82
  },
  {
    subtype: 'system',
    value: 'сервер',
    patterns: [
      /(^|[^а-яёa-z0-9_])сервер([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])сервере([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])впс([^а-яёa-z0-9_]|$)/i,
      /(^|[^а-яёa-z0-9_])vps([^а-яёa-z0-9_]|$)/i
    ],
    rule: 'entity_server_v3',
    confidence: 0.8,
    extraGuard: isLikelyProjectServerContext
  }
]

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isInsideQuotes(text, value) {
  const source = String(text || '')
  const needle = normalize(value)

  if (!source || !needle) return false

  const quotedPattern = needle
    .split(/\s+/)
    .map(escapeRegex)
    .join('\\s+')

  return new RegExp(
    `[«"][^«»"]*${quotedPattern}[^«»"]*[»"]`,
    'i'
  ).test(source)
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasBoundedPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase)
  if (!normalizedPhrase) return false

  const pattern = normalizedPhrase
    .split(/\s+/)
    .map(escapeRegex)
    .join('\\s+')

  return new RegExp(
    `(^|[^а-яёa-z0-9_])${pattern}([^а-яёa-z0-9_]|$)`,
    'i'
  ).test(text)
}

function isQuotedMetaEntityContext(text) {
  const source = normalize(text)

  if (!source) return false

  return (
    /не\s+как\s+[«"].+[»"]/.test(source) ||
    /как\s+роль\s+внутри\s+пример[а-я]*/.test(source) ||
    /внутри\s+пример[а-я]*/.test(source) ||
    /это\s+было\s+сказано\s+не\s+как/.test(source)
  )
}

function buildEntityCandidate({
  subtype,
  value,
  clause,
  context,
  rule,
  confidence
}) {
  return makeCandidate({
    type: 'entity',
    subtype,
    text: clause.clauseText || clause.text || '',
    clause,
    context,
    source: {
      extractor: 'entity.regex',
      rule
    },
    confidence,
    certainty: 'medium',
    dedupeKeyHint: `entity::${subtype}::${normalize(value)}`,
    payload: {
      entityValue: value
    }
  })
}

function isSafeEntityClause(text, context, event) {
  const source = normalize(text)

  if (!source) return false
  if (event.role !== 'user') return false
  if (context.isReported) return false
  if (context.isQuoted) return false
  if (isQuotedMetaEntityContext(text)) return false
  if (source.length > 140) return false

  return true
}

function isLikelyOwnedVenueContext(text) {
  const source = normalize(text)

  return (
    hasBoundedPhrase(source, 'мой') ||
    hasBoundedPhrase(source, 'мое') ||
    hasBoundedPhrase(source, 'моё') ||
    hasBoundedPhrase(source, 'моя') ||
    hasBoundedPhrase(source, 'мои') ||
    hasBoundedPhrase(source, 'у меня') ||
    hasBoundedPhrase(source, 'в моем') ||
    hasBoundedPhrase(source, 'в моём') ||
    hasBoundedPhrase(source, 'в кофейне') ||
    hasBoundedPhrase(source, 'в ресторане') ||
    hasBoundedPhrase(source, 'сотрудник') ||
    hasBoundedPhrase(source, 'смена') ||
    hasBoundedPhrase(source, 'заказы')
  )
}

function isLikelyProjectServerContext(text) {
  const source = normalize(text)

  return (
    hasBoundedPhrase(source, 'проект') ||
    hasBoundedPhrase(source, 'бот') ||
    hasBoundedPhrase(source, 'код') ||
    hasBoundedPhrase(source, 'репо') ||
    hasBoundedPhrase(source, 'git') ||
    hasBoundedPhrase(source, 'терминал') ||
    hasBoundedPhrase(source, 'сервер') ||
    hasBoundedPhrase(source, 'vps') ||
    hasBoundedPhrase(source, 'впс') ||
    hasBoundedPhrase(source, 'лежит') ||
    hasBoundedPhrase(source, 'развернул') ||
    hasBoundedPhrase(source, 'поднял')
  )
}

function isLikelyRealBrotherContext(text) {
  const source = normalize(text)

  if (source === 'брат') return false
  if (/^ну\s+брат[.!?…]?$/i.test(source)) return false
  if (/^брат[.!?…]?$/i.test(source)) return false

  return (
    hasBoundedPhrase(source, 'мой брат') ||
    hasBoundedPhrase(source, 'у брата') ||
    hasBoundedPhrase(source, 'с братом') ||
    hasBoundedPhrase(source, 'брату') ||
    (hasBoundedPhrase(source, 'брат') && (
      hasBoundedPhrase(source, 'сказал') ||
      hasBoundedPhrase(source, 'написал') ||
      hasBoundedPhrase(source, 'позвонил') ||
      hasBoundedPhrase(source, 'работает') ||
      hasBoundedPhrase(source, 'живет') ||
      hasBoundedPhrase(source, 'живёт')
    ))
  )
}

function matchesAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(text))
}

function detectOne({ clause, context, event }) {
  const text = clause.clauseText || clause.text || ''
  const lowered = normalize(text)
  const results = []

  if (!isSafeEntityClause(text, context, event)) return results

  for (const def of ENTITY_DEFS) {
    if (!matchesAny(def.patterns, lowered)) continue
    if (typeof def.extraGuard === 'function' && !def.extraGuard(text)) continue
    if (isInsideQuotes(text, def.value)) continue

    results.push(
      buildEntityCandidate({
        subtype: def.subtype,
        value: def.value,
        clause,
        context,
        rule: def.rule,
        confidence: def.confidence
      })
    )
  }

  return results
}

async function detect({ clauses, event }) {
  return runRuleList({
    clauses,
    detectorName: 'entity',
    detectOne: (payload) => detectOne({ ...payload, event })
  })
}

module.exports = {
  detect
}
