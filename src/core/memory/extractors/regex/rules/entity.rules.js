'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')

const ANDREY_RE = /(^|[^а-яёa-z0-9_])андрей([^а-яёa-z0-9_]|$)/i
const HUTAO_RE_1 = /ху\s+тао/i
const HUTAO_RE_2 = /хутао/i

const CHATGPT_RE = /(^|[^а-яёa-z0-9_])chatgpt([^а-яёa-z0-9_]|$)/i
const VPS_RE = /(^|[^а-яёa-z0-9_])vps([^а-яёa-z0-9_]|$)/i
const TELEGRAM_RE = /(^|[^а-яёa-z0-9_])telegram([^а-яёa-z0-9_]|$)/i
const LLM_RE = /(^|[^а-яёa-z0-9_])llm([^а-яёa-z0-9_]|$)/i
const REGEX_RE = /(^|[^а-яёa-z0-9_])regex([^а-яёa-z0-9_]|$)/i
const JSON_RE = /(^|[^а-яёa-z0-9_])json([^а-яёa-z0-9_]|$)/i
const API_RE = /(^|[^а-яёa-z0-9_])api([^а-яёa-z0-9_]|$)/i

const OPEN_LOOPS_RE = /open\s+loops/i
const REGEX_EXTRACTOR_RE = /regex\s+extractor/i
const LLM_EXTRACTOR_RE = /llm\s+extractor/i
const ENTITY_EXTRACTOR_RE = /entity\s+extractor/i
const FACT_EXTRACTOR_RE = /fact\s+extractor/i
const EPISODIC_EXTRACTOR_RE = /episodic\s+extractor/i
const PIPELINE_RE = /(^|[^а-яёa-z0-9_])pipeline([^а-яёa-z0-9_]|$)/i
const LIFE_ENGINE_RE = /движок\s+жизни/i

const SYSTEM_RE = /(^|[^а-яёa-z0-9_])система([^а-яёa-z0-9_]|$)/i
const BIOCHIP_RE = /биочип/i
const CHAIR_RE = /(^|[^а-яёa-z0-9_])стул([^а-яёa-z0-9_]|$)/i
const BOXES_RE = /коробочк(и|а|ек|ам|ами|ах)?/i
const MECHANISM_RE = /механизм/i
const SERVER_RE = /(^|[^а-яёa-z0-9_])сервер([^а-яёa-z0-9_]|$)/i
const FILE_RE = /(^|[^а-яёa-z0-9_])файл([^а-яёa-z0-9_]|$)/i
const LOG_RE = /(^|[^а-яёa-z0-9_])лог(и)?([^а-яёa-z0-9_]|$)/i
const SNAPSHOT_RE = /(^|[^а-яёa-z0-9_])снапшот([^а-яёa-z0-9_]|$)/i
const MEM0_RE = /(^|[^а-яёa-z0-9_])mem0([^а-яёa-z0-9_]|$)/i

const ABSTRACT_MEMORY_RE = /(^|[^а-яёa-z0-9_])(память|памяти|памятью)([^а-яёa-z0-9_]|$)/i
const ABSTRACT_INFRA_RE = /инфраструктур/i
const WHOLE_SENTENCE_GARBAGE_RE = /чтобы[\s\S]*осталась\s+живой/i

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTechnicalNoiseClause(text) {
  const source = normalize(text)

  if (!source) return false

  const technicalMarkers = [
    'regex',
    'llm',
    'json',
    'api',
    'extractor',
    'экстрактор',
    'pipeline',
    'пайплайн',
    'mem0',
    'снапшот',
    'лог',
    'логи',
    'мердж',
    'debug',
    'дебаг',
    'test',
    'тест'
  ]

  const hitCount = technicalMarkers.filter((marker) => source.includes(marker)).length

  return (
    source.length >= 120 &&
    hitCount >= 2
  )
}

function allowTechnicalSystemEntity(text, value) {
  const source = normalize(text)

  if (!source) return false
  if (!source.includes(String(value || '').toLowerCase())) return false

  if (isTechnicalNoiseClause(source)) {
    return false
  }

  if (source.length > 90) {
    return false
  }

  return true
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
    text: value,
    clause,
    context,
    source: {
      extractor: 'entity.regex',
      rule
    },
    confidence,
    dedupeKeyHint: `entity::${subtype}::${value.toLowerCase()}`,
    payload: {
      name: value,
      normalizedName: value.toLowerCase(),
      entityType: subtype
    }
  })
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isFalseEntity(text, lowered, event) {
  if (event.role !== 'user') return true
  if (!text) return true
  if (WHOLE_SENTENCE_GARBAGE_RE.test(lowered)) return true
  if (ABSTRACT_INFRA_RE.test(lowered)) return true
  return false
}

function hasSpecificProjectContext(lowered) {
  return (
    /экстрактор/i.test(lowered) ||
    /regex\s+module/i.test(lowered) ||
    /regex\s+modul/i.test(lowered) ||
    /regex\s+extractor/i.test(lowered) ||
    /модул/i.test(lowered) ||
    /пайплайн/i.test(lowered) ||
    /pipeline/i.test(lowered) ||
    /логиру/i.test(lowered) ||
    /работа(ет|ют|л|ла)/i.test(lowered) ||
    /добавил/i.test(lowered) ||
    /собрал/i.test(lowered) ||
    /создал/i.test(lowered)
  )
}

function allowGenericObject(lowered, value) {
  const normalizedValue = normalize(value)

  if (normalizedValue === 'сервер') {
    return /(стоит|поднят|отдельно|на\s+vps|на\s+сервере)/i.test(lowered)
  }

  if (normalizedValue === 'коробочки') {
    return /(работа(ют|ет)|собрал|из\s+\d+\s+коробоч)/i.test(lowered)
  }

  if (normalizedValue === 'биочип') {
    return true
  }

  if (normalizedValue === 'стул') {
    return /(стоит|рядом|возле|на\s+стуле)/i.test(lowered)
  }

  return false
}

function pushIf(results, test, payload) {
  if (test) results.push(payload)
}

function detectOne({ clause, context, event }) {
  const text = clause.text || clause.clauseText || ''
  const lowered = normalize(clause.normalizedText || text)
  const results = []

  if (isFalseEntity(text, lowered, event)) return results

  const blockAbstractMemory = ABSTRACT_MEMORY_RE.test(lowered)

  if (!blockAbstractMemory) {
    pushIf(results, ANDREY_RE.test(lowered),
      buildEntityCandidate({
        subtype: 'person',
        value: 'Андрей',
        clause,
        context,
        rule: 'entity_andrey_v3',
        confidence: 0.9
      }))

    pushIf(results, HUTAO_RE_1.test(lowered) || HUTAO_RE_2.test(lowered),
      buildEntityCandidate({
        subtype: 'person',
        value: 'Ху Тао',
        clause,
        context,
        rule: 'entity_hutao_v3',
        confidence: 0.9
      }))
  }

  pushIf(results, REGEX_EXTRACTOR_RE.test(lowered),
    buildEntityCandidate({
      subtype: 'project',
      value: 'regex extractor',
      clause,
      context,
      rule: 'entity_regex_extractor_v3',
      confidence: 0.9
    }))

  pushIf(results, LLM_EXTRACTOR_RE.test(lowered),
    buildEntityCandidate({
      subtype: 'project',
      value: 'llm extractor',
      clause,
      context,
      rule: 'entity_llm_extractor_v2',
      confidence: 0.88
    }))

  pushIf(results, ENTITY_EXTRACTOR_RE.test(lowered),
    buildEntityCandidate({
      subtype: 'project',
      value: 'entity extractor',
      clause,
      context,
      rule: 'entity_entity_extractor_v2',
      confidence: 0.88
    }))

  pushIf(results, FACT_EXTRACTOR_RE.test(lowered),
    buildEntityCandidate({
      subtype: 'project',
      value: 'fact extractor',
      clause,
      context,
      rule: 'entity_fact_extractor_v2',
      confidence: 0.88
    }))

  pushIf(results, EPISODIC_EXTRACTOR_RE.test(lowered),
    buildEntityCandidate({
      subtype: 'project',
      value: 'episodic extractor',
      clause,
      context,
      rule: 'entity_episodic_extractor_v2',
      confidence: 0.88
    }))

  pushIf(results, OPEN_LOOPS_RE.test(lowered),
    buildEntityCandidate({
      subtype: 'project',
      value: 'open loops',
      clause,
      context,
      rule: 'entity_open_loops_v2',
      confidence: 0.82
    }))

  pushIf(results, PIPELINE_RE.test(lowered),
    buildEntityCandidate({
      subtype: 'project',
      value: 'pipeline',
      clause,
      context,
      rule: 'entity_pipeline_v2',
      confidence: 0.8
    }))

  pushIf(results, LIFE_ENGINE_RE.test(lowered),
    buildEntityCandidate({
      subtype: 'project',
      value: 'движок жизни',
      clause,
      context,
      rule: 'entity_life_engine_v2',
      confidence: 0.84
    }))

  if (hasSpecificProjectContext(lowered)) {
    pushIf(results, CHATGPT_RE.test(lowered) && allowTechnicalSystemEntity(text, 'chatgpt'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'chatgpt',
        clause,
        context,
        rule: 'entity_chatgpt_v3',
        confidence: 0.78
      }))

    pushIf(results, VPS_RE.test(lowered) && allowTechnicalSystemEntity(text, 'vps'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'vps',
        clause,
        context,
        rule: 'entity_vps_v3',
        confidence: 0.78
      }))

    pushIf(results, TELEGRAM_RE.test(lowered) && allowTechnicalSystemEntity(text, 'telegram'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'telegram',
        clause,
        context,
        rule: 'entity_telegram_v3',
        confidence: 0.78
      }))

    pushIf(results, LLM_RE.test(lowered) && allowTechnicalSystemEntity(text, 'llm'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'llm',
        clause,
        context,
        rule: 'entity_llm_v3',
        confidence: 0.76
      }))

    pushIf(results, REGEX_RE.test(lowered) && allowTechnicalSystemEntity(text, 'regex'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'regex',
        clause,
        context,
        rule: 'entity_regex_v3',
        confidence: 0.76
      }))

    pushIf(results, JSON_RE.test(lowered) && allowTechnicalSystemEntity(text, 'json'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'json',
        clause,
        context,
        rule: 'entity_json_v3',
        confidence: 0.76
      }))

    pushIf(results, API_RE.test(lowered) && allowTechnicalSystemEntity(text, 'api'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'api',
        clause,
        context,
        rule: 'entity_api_v3',
        confidence: 0.76
      }))

    pushIf(results, SNAPSHOT_RE.test(lowered) && allowTechnicalSystemEntity(text, 'снапшот'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'снапшот',
        clause,
        context,
        rule: 'entity_snapshot_v1',
        confidence: 0.72
      }))

    pushIf(results, MEM0_RE.test(lowered) && allowTechnicalSystemEntity(text, 'mem0'),
      buildEntityCandidate({
        subtype: 'system',
        value: 'mem0',
        clause,
        context,
        rule: 'entity_mem0_v1',
        confidence: 0.74
      }))
  }

  if (allowGenericObject(lowered, 'биочип') && BIOCHIP_RE.test(lowered)) {
    results.push(buildEntityCandidate({
      subtype: 'object',
      value: 'биочип',
      clause,
      context,
      rule: 'entity_biochip_v2',
      confidence: 0.84
    }))
  }

  if (allowGenericObject(lowered, 'стул') && CHAIR_RE.test(lowered)) {
    results.push(buildEntityCandidate({
      subtype: 'object',
      value: 'стул',
      clause,
      context,
      rule: 'entity_chair_v2',
      confidence: 0.74
    }))
  }

  if (allowGenericObject(lowered, 'коробочки') && BOXES_RE.test(lowered)) {
    results.push(buildEntityCandidate({
      subtype: 'object',
      value: 'коробочки',
      clause,
      context,
      rule: 'entity_boxes_v2',
      confidence: 0.78
    }))
  }

  if (allowGenericObject(lowered, 'сервер') && SERVER_RE.test(lowered)) {
    results.push(buildEntityCandidate({
      subtype: 'object',
      value: 'сервер',
      clause,
      context,
      rule: 'entity_server_v2',
      confidence: 0.8
    }))
  }

  return results
}

async function detect({ clauses, event }) {
  return runRuleList({
    clauses,
    detectOne: (entry) => detectOne({ ...entry, event })
  })
}

module.exports = {
  detect
}