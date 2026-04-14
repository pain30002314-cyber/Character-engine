'use strict'

const { buildCandidateId } = require('../../core/ids')

function makeCandidate({
  type,
  subtype,
  text,
  clause,
  context,
  source,
  payload,
  confidence = 0.8,
  polarity = null,
  certainty = null,
  tenseHint = null,
  timeAnchor = null,
  actor = null,
  target = null,
  about = [],
  dedupeKeyHint = null,
  negated = false
}) {
  return {
    id: buildCandidateId(type, context.clauseId, text),
    type,
    subtype,
    text,
    unitText: clause.text,
    normalizedText: String(text || '').toLowerCase(),

    actor,
    target,
    about,

    polarity,
    certainty,
    tenseHint,
    timeAnchor,

    negated,
    quoted: context.hasQuote,
    reported: context.isReported,
    hypothetical: context.isHypothetical,
    conditional: context.isConditional,
    interrogative: context.isQuestion,
    imperative: context.isImperative,
    hedged: context.isHedged,

    confidence,
    source,
    payload,
    dedupeKeyHint
  }
}

module.exports = {
  makeCandidate
}