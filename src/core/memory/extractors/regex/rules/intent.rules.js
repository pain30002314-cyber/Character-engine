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

function detectTimeHint(text) {
  const source = String(text || '').toLowerCase()

  if (source.includes('сегодня')) return 'today'
  if (source.includes('завтра')) return 'tomorrow'
  if (source.includes('потом')) return 'later'
  if (source.includes('позже')) return 'later'
  if (source.includes('пока')) return 'for_now'
  if (source.includes('сразу')) return 'immediate'
  if (source.includes('вечером')) return 'evening'

  return null
}

function cleanActionText(text) {
  const source = String(text || '').trim()

  return source
    .replace(/^(я\s+)?хочу\s+/i, '')
    .replace(/^(я\s+)?собираюсь\s+/i, '')
    .replace(/^(я\s+)?планирую\s+/i, '')
    .replace(/^думаю\s+заняться\s+/i, '')
    .replace(/^(я\s+)?попробую\s+/i, '')
    .replace(/^(я\s+)?буду\s+/i, '')
    .replace(/^(я\s+)?не\s+хочу\s+/i, '')
    .replace(/^(я\s+)?не\s+буду\s+/i, '')
    .replace(/^отложим\s+/i, '')
    .replace(/^можно\s+не\s+/i, '')
    .replace(/^пока\s+/i, '')
    .replace(/^давай\s+/i, '')
    .trim()
}

function buildIntentCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  certainty,
  timeAnchor = null,
  timeHint = null
}) {
  const actor = actorRef(context.actorRole)
  const cleanedAction = cleanActionText(text)

  return makeCandidate({
    type: 'intent',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'intent.regex',
      rule
    },
    actor,
    about: [actor],
    confidence,
    certainty,
    tenseHint: subtype === 'planned' ? 'future' : null,
    timeAnchor,
    dedupeKeyHint: `intent::${subtype}::speaker::${text.toLowerCase()}`,
    payload: {
      status: subtype,
      action: cleanedAction || text,
      timeHint
    }
  })
}

function isFalsePositiveIntent(text, context) {
  const source = String(text || '').toLowerCase()

  if (context.isQuestion) return true
  if (/может,\s*я\s+просто\s+разн/i.test(source)) return true
  if (/скрывать\s+не\s+буду,\s*ты\s+меня\s+и\s+научила/i.test(source)) return true

  if (
    includesAny(source, [
      'я не буду помнить',
      'ты запомнишь',
      'я уже представлю',
      'по идее',
      'могу привести',
      'я знаю, что',
      'я прекрасно знаю',
      'если ты',
      'если я',
      'когда ты',
      'когда я'
    ])
  ) {
    return true
  }

  return false
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const lowered = clause.clauseNormalizedText
  const results = []

  if (!text || isFalsePositiveIntent(text, context)) return results

  const timeHint = detectTimeHint(text)

  if (/(завтра|потом|позже|вечером)/i.test(lowered) && /(сделаю|вернусь|добью|проверю|посмотрю)/i.test(lowered)) {
    results.push(
      buildIntentCandidate({
        subtype: 'planned',
        text,
        clause,
        context,
        rule: 'planned_v1',
        confidence: 0.9,
        certainty: 'high',
        timeAnchor: timeHint,
        timeHint
      })
    )
  }

  if (/^хочу[.!?]?$/i.test(text) || /(^|\s)я\s+хочу\s+/i.test(lowered)) {
    results.push(
      buildIntentCandidate({
        subtype: 'wanted',
        text,
        clause,
        context,
        rule: 'wanted_v1',
        confidence: 0.84,
        certainty: /^хочу[.!?]?$/i.test(text) ? 'medium' : 'high',
        timeHint
      })
    )
  }

  if (/попробую/i.test(lowered) || /я\s+бы,\s*наверное/i.test(lowered)) {
    results.push(
      buildIntentCandidate({
        subtype: 'considering',
        text,
        clause,
        context,
        rule: 'considering_v1',
        confidence: 0.78,
        certainty: 'low',
        timeHint
      })
    )
  }

  if (/пока\s+не\s+хочу/i.test(lowered)) {
    results.push(
      buildIntentCandidate({
        subtype: 'avoiding',
        text,
        clause,
        context,
        rule: 'avoiding_v1',
        confidence: 0.88,
        certainty: 'high',
        timeAnchor: 'for_now',
        timeHint: 'for_now'
      })
    )
  }

  if (/я\s+не\s+буду/i.test(lowered) || /^не\s+буду/i.test(lowered)) {
    results.push(
      buildIntentCandidate({
        subtype: 'refused',
        text,
        clause,
        context,
        rule: 'refused_v1',
        confidence: 0.84,
        certainty: 'high',
        timeAnchor: lowered.includes('пока') ? 'for_now' : null,
        timeHint: lowered.includes('пока') ? 'for_now' : timeHint
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
