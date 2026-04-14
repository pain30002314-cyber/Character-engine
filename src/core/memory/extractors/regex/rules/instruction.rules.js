'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')

const LETS_RE = /(^|[^а-яёa-z0-9_])давай([^а-яёa-z0-9_]|$)/i
const FIRST_RE = /(^|[^а-яёa-z0-9_])сначала([^а-яёa-z0-9_]|$)/i
const DONT_TOUCH_RE = /не\s+трога(ем|й)/i
const REMEMBER_RE = /(^|[^а-яёa-z0-9_])запомни([^а-яёa-z0-9_]|$)/i
const STRICT_ORDER_RE = /ид(е|ё)м\s+строго\s+по\s+шагам/i
const LOOK_FOLDER_RE = /смотри[\s\S]*папк/i

function buildInstructionCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  payload
}) {
  return makeCandidate({
    type: 'instruction',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'instruction.regex',
      rule
    },
    confidence,
    imperative: true,
    dedupeKeyHint: `instruction::${subtype}::${text.toLowerCase()}`,
    payload
  })
}

function normalize(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLongExplanatoryClause(text) {
  const source = normalize(text).toLowerCase()

  if (!source) return false

  const wordCount = source.split(/\s+/).filter(Boolean).length

  return (
    wordCount >= 12 &&
    (
      source.includes('вместо того, чтобы') ||
      source.includes('на самом деле') ||
      source.includes('это ни на что') ||
      source.includes('не более') ||
      source.includes('потому что')
    )
  )
}

function isRealConversationInstruction(text) {
  const source = normalize(text).toLowerCase()

  if (!source) return false
  if (isLongExplanatoryClause(source)) return false

  if (LETS_RE.test(source)) return true
  if (LOOK_FOLDER_RE.test(source)) return true

  if (FIRST_RE.test(source)) {
    return (
      /^сначала\b/i.test(source) ||
      /(^|[\s,.-])сначала\s+(смотрим|делаем|разберем|разберём|запустим|починим|идем|идём)/i.test(source)
    )
  }

  return false
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const lowered = clause.clauseNormalizedText
  const results = []

  if (!text) return results

  if (DONT_TOUCH_RE.test(lowered) || STRICT_ORDER_RE.test(lowered)) {
    results.push(
      buildInstructionCandidate({
        subtype: 'workflow_instruction',
        text,
        clause,
        context,
        rule: 'workflow_instruction_v2',
        confidence: 0.88,
        payload: {
          instructionText: text,
          instructionScope: 'workflow',
          priority: 0.9
        }
      })
    )
  }

  if (isRealConversationInstruction(text)) {
    results.push(
      buildInstructionCandidate({
        subtype: 'conversation_instruction',
        text,
        clause,
        context,
        rule: 'conversation_instruction_v2',
        confidence: 0.82,
        payload: {
          instructionText: text,
          instructionScope: 'conversation',
          priority: 0.75
        }
      })
    )
  }

  if (REMEMBER_RE.test(lowered)) {
    results.push(
      buildInstructionCandidate({
        subtype: 'priority_instruction',
        text,
        clause,
        context,
        rule: 'priority_instruction_v1',
        confidence: 0.84,
        payload: {
          instructionText: text,
          instructionScope: 'priority',
          priority: 0.88
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