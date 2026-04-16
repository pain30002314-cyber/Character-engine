'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')

const WANT_RE = /^(?:я\s+)?хочу\s+(.+)/i
const DONT_WANT_RE = /^(?:я\s+)?не\s+хочу\s+(.+)/i

const WILL_RE = /^(?:я\s+)?буду\s+(.+)/i
const WONT_RE = /^(?:я\s+)?не\s+буду\s+(.+)/i

const NEED_ME_RE = /^мне\s+нужно\s+(.+)/i
const NEED_GENERIC_RE = /^(?:мне\s+)?(?:надо|нужно)\s+(.+)/i

const PLAN_RE = /^(?:я\s+)?планирую\s+(.+)/i
const GOING_TO_RE = /^(?:я\s+)?собираюсь\s+(.+)/i
const TRY_RE = /^(?:я\s+)?попробую\s+(.+)/i

const INLINE_WONT_RE = /(?:^|[^а-яёa-z0-9_])не\s+буду\s+(.+)/i
const INLINE_NEED_RE = /(?:^|[^а-яёa-z0-9_])мне\s+(?:сегодня|завтра|потом|позже)?\s*нужно(?:\s+будет)?\s+(.+)/i
const INLINE_NEED_GENERIC_RE = /(?:^|[^а-яёa-z0-9_])(?:сегодня|завтра|потом|позже)?\s*(?:надо|нужно)(?:\s+будет)?\s+(.+)/i
const INLINE_RETURN_RE = /(?:^|[^а-яёa-z0-9_])вернусь(?:\s+(.+))?$/i

const PROMISE_RE = /(?:^|[^а-яёa-z0-9_])я\s+обещаю,\s*что\s+(.+)/i
const KEEP_PROMISE_RE = /(?:^|[^а-яёa-z0-9_])не\s+отказываюсь\s+от\s+(?:этого\s+)?обещани(?:я|й)\b/i
const WE_WILL_RE = /(?:^|[^а-яёa-z0-9_])(?:мы\s+)?(.+?)\s+будем\s+(.+)/i
const SHOULD_SEND_RE = /(?:^|[^а-яёa-z0-9_])(сегодня|завтра|сегодня-завтра|потом|позже)?\s*должны\s+(?:мне\s+)?(скинуть|прислать|отправить|дать)\s+(.+)/i

const PROMISE_RE = /(?:^|[^а-яёa-z0-9_])я\s+обещаю(?:,\s*что)?\s+(.+)/i
const KEEP_PROMISE_RE = /(?:^|[^а-яёa-z0-9_])не\s+отказываюсь\s+от\s+(?:этого\s+)?обещани(?:я|й)(?:\s|$)/i
const INLINE_WONT_RE = /(?:^|[^а-яёa-z0-9_])(.+?)?\bне\s+буду\s+(.+)/i

const FUTURE_TASK_RE =
  /^(завтра|потом|позже|сегодня)\s+(.{0,120}?(сделаю|проверю|посмотрю|вернусь|добью|разберу|разберусь|доделаю|починю).*)$/i

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function normalize(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectTimeHint(text) {
  const source = String(text || '').toLowerCase()

  if (source.includes('сегодня')) return 'today'
  if (source.includes('завтра')) return 'tomorrow'
  if (source.includes('потом')) return 'later'
  if (source.includes('позже')) return 'later'

  return null
}

function buildIntentCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  certainty,
  action
}) {
  const actor = actorRef(context.actorRole)
  const timeHint = detectTimeHint(text)

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
    timeAnchor: timeHint,
    dedupeKeyHint: `intent::${subtype}::speaker::${text.toLowerCase()}`,
    payload: {
      status: subtype,
      action: normalize(action || text),
      timeHint
    }
  })
}

function isFalsePositiveIntent(text) {
  const source = String(text || '').toLowerCase()

  if (/может,\s*я\s+просто\s+разн/i.test(source)) return true
  if (/скрывать\s+не\s+буду,\s*ты\s+меня\s+и\s+научила/i.test(source)) return true

  if (
    [
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
    ].some((needle) => source.includes(needle))
  ) {
    return true
  }

  return false
}

function isSafeExplicitIntent(text, context) {
  const source = normalize(text)

  if (!source) return false
  if (context.isQuestion) return false
  if (context.isConditional) return false
  if (context.isHypothetical) return false
  if (context.isReported) return false
  if (isFalsePositiveIntent(source)) return false

  return true
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const results = []

  if (!text || !isSafeExplicitIntent(text, context)) return results

  const source = normalize(text)

  const matchers = [
    {
      regex: DONT_WANT_RE,
      subtype: 'avoiding',
      rule: 'explicit_dont_want_v1',
      confidence: 0.88,
      certainty: 'high'
    },
    {
      regex: WONT_RE,
      subtype: 'refused',
      rule: 'explicit_wont_v1',
      confidence: 0.86,
      certainty: 'high'
    },
    {
      regex: WANT_RE,
      subtype: 'wanted',
      rule: 'explicit_want_v1',
      confidence: 0.86,
      certainty: 'high'
    },
    {
      regex: NEED_ME_RE,
      subtype: 'needed',
      rule: 'explicit_need_me_v1',
      confidence: 0.9,
      certainty: 'high'
    },
    {
      regex: NEED_GENERIC_RE,
      subtype: 'needed',
      rule: 'explicit_need_generic_v1',
      confidence: 0.86,
      certainty: 'high'
    },
    {
      regex: PLAN_RE,
      subtype: 'planned',
      rule: 'explicit_plan_v1',
      confidence: 0.88,
      certainty: 'high'
    },
    {
      regex: GOING_TO_RE,
      subtype: 'planned',
      rule: 'explicit_going_to_v1',
      confidence: 0.88,
      certainty: 'high'
    },
    {
      regex: WILL_RE,
      subtype: 'planned',
      rule: 'explicit_will_v1',
      confidence: 0.86,
      certainty: 'high'
    },
    {
      regex: TRY_RE,
      subtype: 'considering',
      rule: 'explicit_try_v1',
      confidence: 0.8,
      certainty: 'medium'
    }
  ]

  const inlineMatchers = [
    {
      regex: INLINE_WONT_RE,
      subtype: 'refused',
      rule: 'inline_wont_v1',
      confidence: 0.84,
      certainty: 'high'
    },
    {
      regex: INLINE_NEED_RE,
      subtype: 'needed',
      rule: 'inline_need_v1',
      confidence: 0.86,
      certainty: 'high'
    },
    {
      regex: INLINE_NEED_GENERIC_RE,
      subtype: 'needed',
      rule: 'inline_need_generic_v1',
      confidence: 0.82,
      certainty: 'medium'
    },
    {
      regex: INLINE_RETURN_RE,
      subtype: 'planned',
      rule: 'inline_return_v1',
      confidence: 0.8,
      certainty: 'medium'
    }
  ]

  for (const matcher of inlineMatchers) {
    const match = source.match(matcher.regex)
    const action = normalize(match?.[1] || match?.[0] || '')

    if (!match || !action) continue

    results.push(
      buildIntentCandidate({
        subtype: matcher.subtype,
        text: source,
        clause,
        context,
        rule: matcher.rule,
        confidence: matcher.confidence,
        certainty: matcher.certainty,
        action
      })
    )

      const lookupMatchers = [
    {
      regex: PROMISE_RE,
      subtype: 'commitment',
      rule: 'promise_v1',
      confidence: 0.9,
      certainty: 'high',
      getAction: (match) => match[1]
    },
    {
      regex: KEEP_PROMISE_RE,
      subtype: 'commitment',
      rule: 'promise_keep_v1',
      confidence: 0.88,
      certainty: 'high',
      getAction: () => 'не отказываюсь от обещания'
    },
    {
      regex: SHOULD_SEND_RE,
      subtype: 'planned',
      rule: 'should_send_v1',
      confidence: 0.86,
      certainty: 'high',
      getAction: (match) => `${match[2]} ${match[3]}`.trim()
    }
  ]

  for (const matcher of lookupMatchers) {
    const match = source.match(matcher.regex)
    if (!match) continue

    const action = normalize(matcher.getAction(match))
    if (!action) continue

    results.push(
      buildIntentCandidate({
        subtype: matcher.subtype,
        text: source,
        clause,
        context,
        rule: matcher.rule,
        confidence: matcher.confidence,
        certainty: matcher.certainty,
        action
      })
    )

    return results
  }

    const willMatch = source.match(WE_WILL_RE)

  if (
    willMatch &&
    /(?:делать|строить|ремонтировать|запускать|собирать|доделывать|чинить|проверять|смотреть)/i.test(source)
  ) {
    results.push(
      buildIntentCandidate({
        subtype: 'planned',
        text: source,
        clause,
        context,
        rule: 'we_will_v1',
        confidence: 0.82,
        certainty: 'medium',
        action: normalize(source)
      })
    )

    return results
  }

    return results
  }

  const futureTaskMatch = source.match(FUTURE_TASK_RE)
  if (futureTaskMatch && normalize(futureTaskMatch[2])) {
    results.push(
      buildIntentCandidate({
        subtype: 'planned',
        text: source,
        clause,
        context,
        rule: 'future_task_v1',
        confidence: 0.9,
        certainty: 'high',
        action: futureTaskMatch[2]
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
