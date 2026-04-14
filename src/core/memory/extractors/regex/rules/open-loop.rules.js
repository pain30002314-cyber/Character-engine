'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')

const STRICT_QUESTION_RE = /^(зачем|почему|что|кто|где|когда)(?:\s|[?!…]|$)/i
const SOFT_QUESTION_RE = /^(как)(?:\s|[?!…]|$)/i

const RETURN_LATER_RE =
  /(?:(вернемся|вернёмся|вернусь|обсудим|поговорим|разберем|разберём|посмотрим)\s+[\s\S]{0,40}(позже|потом)|(позже|потом)\s+[\s\S]{0,40}(вернемся|вернёмся|вернусь|обсудим|поговорим|разберем|разберём|посмотрим))/i

const SUSPENDED_RE =
  /пока\s+не\s+хочу[\s\S]{0,80}(эту\s+тему|об\s+этом|к\s+этому|это\s+обсуждать|обсуждать\s+это)/i

const FUTURE_TASK_RE =
  /(завтра|позже|потом|сегодня)\s+[\s\S]{0,60}(сделаю|проверю|посмотрю|вернусь|добью|разберу|разберусь|доделаю|починю)/i

const PENDING_DECISION_RE =
  /(надо\s+решить|нужно\s+понять|надо\s+выбрать|нужно\s+выбрать|надо\s+определить|нужно\s+определить)/i

const CONDITIONAL_RHETORICAL_RE =
  /^(а\s+)?если\s+я\s+/i

const TAIL_GARBAGE_QUESTION_RE =
  /^(что|кто|где|когда)\s+[—-]\s+/i

const SUBORDINATE_PREFIX_RE =
  /^(чтобы|если|когда|пока|раз|будто)\s+/i

function buildOpenLoopCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  payload
}) {
  return makeCandidate({
    type: 'open_loop',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'open-loop.regex',
      rule
    },
    confidence,
    dedupeKeyHint: `open_loop::${subtype}::${text.toLowerCase()}`,
    payload
  })
}

function normalize(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractQuestionCore(text) {
  const source = normalize(text)
  if (!source || !source.includes('?')) return source

  const parts = source
    .split(/(?<=[.?!…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const lastQuestionPart = [...parts].reverse().find((part) => part.includes('?'))
  if (!lastQuestionPart) return source

  const cleaned = lastQuestionPart
    .replace(/^(слушай|кстати|ну|а)\s*,?\s*/i, '')
    .trim()

  return cleaned || lastQuestionPart
}

function isFalsePositiveQuestionCore(text, context) {
  const source = normalize(text).toLowerCase()

  if (!source) return true

  if (context?.isConditional) return true
  if (context?.isHypothetical) return true
  if (context?.isReported) return true

  if (CONDITIONAL_RHETORICAL_RE.test(source)) return true
  if (TAIL_GARBAGE_QUESTION_RE.test(source)) return true
  if (SUBORDINATE_PREFIX_RE.test(source)) return true

  if (/^что\s+важно,\s+а\s+что\s+[—-]\s+мусор\?$/i.test(source)) return true
  if (/^что\s+[—-]\s+мусор\?$/i.test(source)) return true

  return false
}

function isEmotionalExclamation(text) {
  const source = normalize(text).toLowerCase()

  return (
    /^(ну|господи|блин|ох|эх|да\s+ладно|серьезно|серьёзно)[!?.…]*$/i.test(source) ||
    /^какой\s+же\s+ты/i.test(source)
  )
}

function isBridgeQuestion(text) {
  const source = normalize(text).toLowerCase()

  return (
    /^(но\s+)?знаешь\s+что\?$/.test(source) ||
    /^(ну\s+)?знаешь\s+что\?$/.test(source) ||
    /^честно\?$/.test(source) ||
    /^серьезно\?$/.test(source) ||
    /^серьёзно\?$/.test(source) ||
    /^правда\?$/.test(source) ||
    /^и\s+что\?$/.test(source) ||
    /^а\s+что\?$/.test(source) ||
    /^через\s+консоль\?$/.test(source)
  )
}

function isDecorativeQuestion(text) {
  const source = normalize(text)

  return (
    /^ну[, ]/i.test(source) ||
    /^разве\s+нет\?$/i.test(source) ||
    /^ты\s+поняла\s+в\s+целом/i.test(source) ||
    /^знаешь\s+сколько\s+раз/i.test(source)
  )
}

function isConditionalQuestion(text) {
  const source = normalize(text).toLowerCase()

  return (
    /^(а\s+)?если\b/.test(source) ||
    /^(а\s+)?если\s+бы\b/.test(source) ||
    /^(ну\s+)?а\s+если\b/.test(source) ||
    /^(и\s+)?если\b/.test(source)
  )
}

function shouldCreateDirectQuestion(text, context) {
  const source = normalize(text)

  if (!source) return false

  if (context?.isConditional) return false
  if (context?.isHypothetical) return false
  if (context?.isReported) return false
  if (!source.endsWith('?')) return false

  const startsLikeQuestion =
    STRICT_QUESTION_RE.test(source) ||
    SOFT_QUESTION_RE.test(source)

  if (isEmotionalExclamation(source)) return false
  if (isDecorativeQuestion(source)) return false
  if (isConditionalQuestion(source)) return false
  if (/^или\s+просто\s+[«"].+[»"]\?$/i.test(source)) return false
  if (/^чтобы\b/i.test(source.toLowerCase())) return false
  if (source.length > 140) return false

  return startsLikeQuestion || source.endsWith('?')
}

function detectOne({ clause, context }) {
  const text = clause?.clauseText || ''
  const lowered = clause?.clauseNormalizedText || normalize(text).toLowerCase()
  const results = []

  if (!text) return results

  const normalized = normalize(text)
  if (isBridgeQuestion(normalized)) return results

  const questionCore = extractQuestionCore(text)

  const isConditionalRhetorical =
    context?.isConditional ||
    context?.isHypothetical ||
    context?.isReported ||
    /^(а\s+)?если\s+/i.test(normalized) ||
    /^если\s+/i.test(normalized) ||
    /^чтобы\s+/i.test(normalized)

  const isTailGarbageQuestion =
    /^что\s+[—-]\s+/i.test(questionCore || '') ||
    /^что\s+важно,\s+а\s+что\s+[—-]\s+мусор\?$/i.test((questionCore || '').toLowerCase())

  if (
    shouldCreateDirectQuestion(text, context) &&
    questionCore &&
    !isConditionalRhetorical &&
    !isFalsePositiveQuestionCore(questionCore, context) &&
    !isTailGarbageQuestion
  ) {
    results.push(
      buildOpenLoopCandidate({
        subtype: 'direct_question',
        text: questionCore,
        clause,
        context,
        rule: 'direct_question_v8',
        confidence: 0.9,
        payload: {
          form: 'question'
        }
      })
    )
  }

  if (RETURN_LATER_RE.test(lowered)) {
    results.push(
      buildOpenLoopCandidate({
        subtype: 'postponed_topic',
        text: normalize(text),
        clause,
        context,
        rule: 'return_later_v3',
        confidence: 0.82,
        payload: {
          form: 'postponed'
        }
      })
    )
  }

  if (SUSPENDED_RE.test(lowered)) {
    results.push(
      buildOpenLoopCandidate({
        subtype: 'suspended_topic',
        text: normalize(text),
        clause,
        context,
        rule: 'suspended_topic_v3',
        confidence: 0.84,
        payload: {
          form: 'suspended'
        }
      })
    )
  }

  if (FUTURE_TASK_RE.test(lowered)) {
    results.push(
      buildOpenLoopCandidate({
        subtype: 'pending_task',
        text: normalize(text),
        clause,
        context,
        rule: 'future_task_v3',
        confidence: 0.78,
        payload: {
          form: 'pending'
        }
      })
    )
  }

  if (PENDING_DECISION_RE.test(lowered)) {
    results.push(
      buildOpenLoopCandidate({
        subtype: 'pending_decision',
        text: normalize(text),
        clause,
        context,
        rule: 'pending_decision_v2',
        confidence: 0.8,
        payload: {
          form: 'decision'
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
