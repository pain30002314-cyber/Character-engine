'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(text, variants) {
  return variants.some((variant) => text.includes(variant))
}

function wordCount(text) {
  return normalizeForMatch(text).split(/\s+/).filter(Boolean).length
}

function isReflectiveSpeechContext(text) {
  const source = normalizeForMatch(text)

  if (!source) return false

  return (
    source.startsWith('не то что я сказал') ||
    source.startsWith('не то что я сказала') ||
    source.startsWith('то что я сказал') ||
    source.startsWith('то что я сказала') ||
    source.startsWith('не то что я спросил') ||
    source.startsWith('не то что я спросила') ||
    source.startsWith('то что я спросил') ||
    source.startsWith('то что я спросила') ||
    source.startsWith('не то что я ответил') ||
    source.startsWith('не то что я ответила') ||
    source.startsWith('то что я ответил') ||
    source.startsWith('то что я ответила') ||
    (
      source.includes('а как') && (
        source.includes('я сказал') ||
        source.includes('я сказала') ||
        source.includes('я спросил') ||
        source.includes('я спросила') ||
        source.includes('я ответил') ||
        source.includes('я ответила')
      )
    ) ||
    source.includes('то как я сказал') ||
    source.includes('то как я сказала') ||
    source.includes('то как я спросил') ||
    source.includes('то как я спросила') ||
    source.includes('то как я ответил') ||
    source.includes('то как я ответила')
  )
}

function isRpActionGarbage(text) {
  const source = normalizeForMatch(text)

  if (!source) return true

  if (
    source === 'пауза' ||
    source === 'тишина' ||
    source === 'молчание'
  ) {
    return true
  }

  if (
    source.startsWith('голос ') ||
    source.startsWith('взгляд ')
  ) {
    return true
  }

  return false
}

function isWeakGestureText(text) {
  const source = normalizeForMatch(text)

  if (!source) return false

  return includesAny(source, [
    'я пожал плечами',
    'я вздохнул',
    'я вздохнула',
    'я улыбнулся',
    'я улыбнулась',
    'я усмехнулся',
    'я усмехнулась',
    'я рассмеялся',
    'я рассмеялась',
    'я засмеялся',
    'я засмеялась',
    'я посмеялся',
    'я посмеялась',
    'я кивнул',
    'я кивнула',
    'я замолчал',
    'я замолчала',
    'я сделал паузу',
    'я сделала паузу',
    'я подмигнул',
    'я подмигнула',
    'я помахал',
    'я помахала',
    'я начал смеяться',
    'я начала смеяться',
    'я начал легонько смеяться',
    'я начала легонько смеяться',
    'я тихонько улыбнулся',
    'я тихонько улыбнулась'
  ])
}

function classifyActionKind(text) {
  const source = normalizeForMatch(text)

  if (
    includesAny(source, [
      'сказал',
      'сказала',
      'сказал я',
      'сказала я',
      'резко сказал',
      'резко сказала',
      'тихо сказал',
      'тихо сказала',
      'спросил',
      'спросила',
      'ответил',
      'ответила',
      'прошептал',
      'прошептала',
      'произнес',
      'произнесла',
      'повторил',
      'повторила',
      'говорить',
      'продолжал я говорить',
      'продолжала я говорить'
    ]) &&
    !isReflectiveSpeechContext(source)
  ) {
    return 'speech'
  }

  if (
    /(^|[\s.,!?:;'"«»()\-])я[\s\S]*(тыкнул|ткнул|коснулся|коснулась|потрогал|потрогала|погладил|погладила|поцеловал|поцеловала|обнял|обняла|подал|подала)([\s.,!?:;'"«»()\-]|$)/i.test(source)
  ) {
    return 'physical'
  }

  if (
    includesAny(source, [
      'улыбнулся',
      'улыбнулась',
      'усмехнулся',
      'усмехнулась',
      'рассмеялся',
      'рассмеялась',
      'засмеялся',
      'засмеялась',
      'посмеялся',
      'посмеялась',
      'кивнул',
      'кивнула',
      'пожал плечами',
      'вздохнул',
      'вздохнула',
      'замолчал',
      'замолчала',
      'сделал паузу',
      'сделала паузу',
      'смеюсь',
      'улыбаюсь',
      'усмехаюсь',
      'вздыхаю',
      'молчу',
      'киваю'
    ])
  ) {
    return 'gesture'
  }

  if (
    includesAny(source, [
      'посмотрел',
      'посмотрела',
      'глянул',
      'глянула',
      'смотрю',
      'смотрит'
    ])
  ) {
    return 'interaction'
  }

  if (
    includesAny(source, [
      'открыл',
      'открыла',
      'закрыл',
      'закрыла',
      'протянул руку',
      'протянула руку',
      'провел рукой',
      'провела рукой',
      'поцеловал',
      'поцеловала',
      'целовать тебя',
      'начал целовать тебя',
      'начала целовать тебя',
      'обнял',
      'обняла',
      'подошел',
      'подошла',
      'тыкнул тебя',
      'ткнул тебя',
      'положил пальцы',
      'положила пальцы',
      'положил кончики пальцев',
      'положила кончики пальцев',
      'положил ладонь',
      'положила ладонь',
      'положил руку',
      'положила руку',
      'коснулся тебя',
      'коснулась тебя',
      'прикоснулся к тебе',
      'прикоснулась к тебе',
      'положил тебе на щеку',
      'положила тебе на щеку'
    ])
  ) {
    return 'physical'
  }

  return 'action'
}

function buildActionCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence
}) {
  const actor = actorRef(context.actorRole)

  return makeCandidate({
    type: 'action',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'action.regex',
      rule
    },
    actor,
    about: [actor],
    confidence,
    dedupeKeyHint: `action::${subtype}::speaker::${text.toLowerCase()}`,
    payload: {
      kind: subtype
    }
  })
}

function isFalseAction(text, context) {
  const source = normalizeForMatch(text)

  if (/мне\s+кажется/.test(source)) return true
  if (/хочу\s+подумать/.test(source)) return true
  if (/^не\s+то\s+что\s+я\s+сказал/.test(source)) return true
  if (/^не\s+то\s+что\s+я\s+сказала/.test(source)) return true

  if (!context.isRp && wordCount(source) > 8) {
    return true
  }

  if (
    /я\s+задумал(ся|ась)/.test(source) &&
    !context.isRp
  ) {
    return true
  }

  if (context.isRp) {
    if (isRpActionGarbage(source)) return true
  }

  return false
}

function looksLikeActionUnit(text, context) {
  const source = normalizeForMatch(text)
  if (!source) return false
  if (isFalseAction(text, context)) return false

  const hasSpeechAction = includesAny(source, [
    'я сказал',
    'я сказала',
    'сказал я',
    'сказала я',
    'я спросил',
    'я спросила',
    'спросил я',
    'спросила я',
    'я ответил',
    'я ответила',
    'ответил я',
    'ответила я',
    'я повторил',
    'я повторила',
    'повторил я',
    'повторила я',
    'я прошептал',
    'я прошептала',
    'прошептал я',
    'прошептала я',
    'я произнес',
    'я произнесла',
    'произнес я',
    'произнесла я',
    'потом я сказал',
    'потом я сказала',
    'потом я спросил',
    'потом я спросила',
    'потом я ответил',
    'потом я ответила',
    'тихо сказал',
    'тихо сказала',
    'резко сказал',
    'резко сказала',
    'продолжал я говорить',
    'продолжала я говорить'
  ])

  if (hasSpeechAction && isReflectiveSpeechContext(source)) {
    return false
  }

  return (
    hasSpeechAction ||
    includesAny(source, [
      'я открыл',
      'я открыла',
      'я закрыл',
      'я закрыла',
      'я пожал плечами',
      'я вздохнул',
      'я вздохнула',
      'я улыбнулся',
      'я улыбнулась',
      'я усмехнулся',
      'я усмехнулась',
      'я рассмеялся',
      'я рассмеялась',
      'я засмеялся',
      'я засмеялась',
      'я посмеялся',
      'я посмеялась',
      'я кивнул',
      'я кивнула',
      'я поцеловал',
      'я поцеловала',
      'я начал целовать тебя',
      'я начала целовать тебя',
      'я обнял',
      'я обняла',
      'я протянул руку',
      'я протянула руку',
      'я тыкнул тебя',
      'я ткнул тебя',
      'тыкнул тебя',
      'ткнул тебя',
      'я положил пальцы',
      'я положила пальцы',
      'я положил кончики пальцев',
      'я положила кончики пальцев',
      'я положил ладонь',
      'я положила ладонь',
      'я положил руку',
      'я положила руку',
      'положил кончики пальцев тебе на щеку',
      'положила кончики пальцев тебе на щеку',
      'положил пальцы тебе на щеку',
      'положила пальцы тебе на щеку',
      'я коснулся тебя',
      'я коснулась тебя',
      'я прикоснулся к тебе',
      'я прикоснулась к тебе',
      'я навис над тобой'
    ])
  )
}

function ruleNameForKind(kind) {
  return {
    speech: 'speech_v2',
    gesture: 'gesture_v2',
    interaction: 'interaction_v1',
    physical: 'physical_v2',
    action: 'action_v1'
  }[kind] || 'action_v1'
}

function detectOne({ clause, context, hasPlainTextInMessage = false }) {
  const text = clause.text || clause.clauseText || ''
  const results = []

  if (!text || !looksLikeActionUnit(text, context)) return results

  const kind = classifyActionKind(text)

  if (
    context.isRp &&
    kind === 'gesture' &&
    hasPlainTextInMessage &&
    isWeakGestureText(text)
  ) {
    return results
  }

  results.push(
    buildActionCandidate({
      subtype: kind,
      text,
      clause,
      context,
      rule: ruleNameForKind(kind),
      confidence:
        kind === 'speech' ? 0.84 :
        kind === 'gesture' ? 0.8 :
        kind === 'interaction' ? 0.8 :
        kind === 'physical' ? 0.86 :
        0.76
    })
  )

  return results
}

async function detect({ clauses }) {
  const hasPlainTextInMessage = (clauses || []).some((entry) => entry?.context && !entry.context.isRp)

  return runRuleList({
    clauses,
    detectOne: (entry) => detectOne({
      ...entry,
      hasPlainTextInMessage
    })
  })
}

module.exports = {
  detect
}