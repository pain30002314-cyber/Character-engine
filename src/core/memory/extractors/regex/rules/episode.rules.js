'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')

function normalizeEpisodeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[.]+$/g, '')
    .trim()
}

function looksLikeQuestion(text) {
  const source = normalizeEpisodeText(text)
  if (!source) return false
  if (source.endsWith('?')) return true
  if (/^(кто|что|где|когда|зачем|почему|как|разве|неужели)\b/i.test(source)) {
    return true
  }
  return false
}

function looksLikeOnlyFact(text) {
  const source = normalizeEpisodeText(text)

  if (!source) return false

  return (
    /^меня\s+зовут(?:$|\s|[,.!?:;])/i.test(source) ||
    /^ты\s+жив[её]шь(?:$|\s|[,.!?:;])/i.test(source) ||
    /^сейчас\s+проверяем(?:$|\s|[,.!?:;])/i.test(source) ||
    /^мы\s+работаем(?:$|\s|[,.!?:;])/i.test(source) ||
    /^мы\s+продолжаем(?:$|\s|[,.!?:;])/i.test(source) ||
    /^я\s+не\s+собираюсь(?:$|\s|[,.!?:;])/i.test(source) ||
    /^обещаю(?:$|\s|[,.!?:;])/i.test(source)
  )
}

function isWeakConversationalStart(text) {
  const source = normalizeEpisodeText(text).toLowerCase()

  if (!source) return false

  return (
    /^у\s+меня[\s\S]{0,80}начал(ось|ся|ась)\s+оно\s+с\b/.test(source) ||
    /^у\s+меня[\s\S]{0,80}начал(ось|ся|ась)\s+с\b/.test(source) ||
    /^у\s+меня[\s\S]{0,80}началось\b/.test(source) ||
    /^(день|утро|утречко|вечер|ночь|ночка)\s+начал(ось|ся|ась)\s+с\b/.test(source)
  )
}

function isWeakRpGesture(text) {
  const source = normalizeEpisodeText(text).toLowerCase()

  return (
    /^я\s+(улыбнулся|улыбнулась|посмеялся|посмеялась|рассмеялся|рассмеялась|пожал\s+плечами|сделал\s+паузу|сделала\s+паузу|кивнул|кивнула|вздохнул|вздохнула)$/i.test(source) ||
    /^я\s+(тихонько\s+посмеялся|тихонько\s+посмеялась|чуть\s+посмеялся|чуть\s+посмеялась)$/i.test(source)
  )
}

function isStrongInteraction(text) {
  const source = normalizeEpisodeText(text).toLowerCase()

  return (
    /(^|[\s,.:;!?-])я\s+(обнял|обняла|поцеловал|поцеловала)(?=$|[\s,.:;!?-])/i.test(source) &&
    /(^|[\s,.:;!?-])(тебя|в\s+щеку|в\s+лоб|в\s+губы)(?=$|[\s,.:;!?-])/i.test(source)
  )
}

function isStrongEvent(text) {
  const source = normalizeEpisodeText(text)

  if (!source) return false

  // Исключаем разговорные стартовые конструкции
  if (
    /(^|\s)у\s+меня[\s\S]*начал(ось|ся|ась)(\s|$|[.,!?:;-])/i.test(source) ||
    /(^|\s)(день|утро|утречко|вечер|ночь|ночка)\s+начал(ось|ся|ась)(\s|$|[.,!?:;-])/i.test(source)
  ) {
    return false
  }
  return (
    /(^|[\s,.:;!?-])(появилось|исчезло|сломалось|началось|закончилось)(?=$|[\s,.:;!?-])/i.test(source) ||
    /^перед\s+нами\s+появил/i.test(source)
  )
}

function buildEpisodeCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence
}) {
  return makeCandidate({
    type: 'episode',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'episode.regex',
      rule
    },
    confidence,
    dedupeKeyHint: `episode::${subtype}::${text.toLowerCase()}`,
    payload: {
      episodeType: subtype
    }
  })
}

function detectOne({ clause, context }) {
  const clauseText = clause?.clauseText || ''
  const unitText = clause?.text || clauseText

  const source = normalizeEpisodeText(unitText)
  const results = []

  if (!source) return results
  if (looksLikeQuestion(source)) return results
  if (looksLikeOnlyFact(source)) return results
  if (isWeakRpGesture(source)) return results
  if (isWeakConversationalStart(source)) return results

  if (isStrongInteraction(source)) {
    results.push(
      buildEpisodeCandidate({
        subtype: 'interaction',
        text: source,
        clause,
        context,
        rule: 'strong_interaction_v2',
        confidence: 0.9
      })
    )
  }

  if (isStrongEvent(source)) {
    results.push(
      buildEpisodeCandidate({
        subtype: 'event',
        text: source,
        clause,
        context,
        rule: 'strong_event_v2',
        confidence: 0.84
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