'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')
const { phraseRegex } = require('../core/regex')

const PROMISE_RE = phraseRegex('обещаю')
const AGREED_RE = /договорились/i
const WE_WILL_RETURN_RE = /мы\s+верн[её]мся[\s\S]*к\s+эт(ой|ому)\s+тем/i
const I_WILL_RETURN_RE = /я\s+вернусь[\s\S]*к\s+эт(ой|ому)/i
const I_WONT_FORGET_RE = /не\s+забуду/i
const REMIND_REVISIT_RE = /вернемся[\s\S]*позже|вернусь[\s\S]*позже/i

const FALSE_PHILOSOPHY_RE = /просто\s+жить/i
const FALSE_QUESTION_RE = /\?\s*$/

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function targetRef() {
  return toRoleRef('assistant', 'ты', 0.98)
}

function buildCommitmentCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  payload
}) {
  const actor = actorRef(context.actorRole)
  const target = targetRef()

  return makeCandidate({
    type: 'commitment',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'commitment.regex',
      rule
    },
    actor,
    target,
    about: [actor, target],
    confidence,
    certainty: 'high',
    tenseHint: 'future',
    dedupeKeyHint: `commitment::${subtype}::speaker::${text.toLowerCase()}`,
    payload
  })
}

function isFalseCommitment(text, lowered, context) {
  if (context.isQuestion || FALSE_QUESTION_RE.test(text)) return true
  if (FALSE_PHILOSOPHY_RE.test(lowered)) return true
  return false
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const lowered = clause.clauseNormalizedText
  const results = []

  if (!text || isFalseCommitment(text, lowered, context)) return results

  if (PROMISE_RE.test(lowered)) {
    results.push(
      buildCommitmentCandidate({
        subtype: 'promise',
        text,
        clause,
        context,
        rule: 'promise_explicit_v1',
        confidence: 0.94,
        payload: {
          text,
          giver: 'event_speaker',
          receiver: 'event_addressee',
          scope: 'conversation',
          status: 'active'
        }
      })
    )
  }

  if (AGREED_RE.test(lowered)) {
    results.push(
      buildCommitmentCandidate({
        subtype: 'agreement',
        text,
        clause,
        context,
        rule: 'agreement_v1',
        confidence: 0.9,
        payload: {
          text,
          giver: 'shared',
          receiver: 'shared',
          scope: 'conversation',
          status: 'active'
        }
      })
    )
  }

  if (WE_WILL_RETURN_RE.test(lowered) || I_WILL_RETURN_RE.test(lowered) || REMIND_REVISIT_RE.test(lowered)) {
    results.push(
      buildCommitmentCandidate({
        subtype: 'revisit',
        text,
        clause,
        context,
        rule: 'revisit_commitment_v1',
        confidence: 0.88,
        payload: {
          text,
          giver: 'event_speaker',
          receiver: 'event_addressee',
          scope: 'topic',
          timeTie: 'later',
          status: 'active'
        }
      })
    )
  }

  if (I_WONT_FORGET_RE.test(lowered)) {
    results.push(
      buildCommitmentCandidate({
        subtype: 'pledge',
        text,
        clause,
        context,
        rule: 'pledge_not_forget_v1',
        confidence: 0.84,
        payload: {
          text,
          giver: 'event_speaker',
          receiver: 'event_addressee',
          scope: 'memory',
          status: 'active'
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