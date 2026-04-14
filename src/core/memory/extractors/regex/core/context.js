'use strict'

function hasNegation(text) {
  return /(^|[^а-яёa-z0-9_])(не|нет|никогда|ни)(^|[^а-яёa-z0-9_])/i.test(text)
}

function hasQuestion(text) {
  const source = String(text || '').trim()

  if (!source) return false

  if (/[!?]\s*$/.test(source) && !/\?\s*$/.test(source)) {
    return false
  }

  if (/\?\s*$/.test(source)) {
    return true
  }

  if (/^(кто|что|где|когда|зачем|почему)/i.test(source)) {
    return true
  }

  if (/^как/i.test(source)) {
    return /^(как\s+(думаешь|считаешь|понять|сделать|быть|это|так|же))/i.test(source)
  }

  return false
}

function hasQuote(text) {
  return /["«»„“]/.test(text)
}

function looksReported(text) {
  return /(^|[^а-яёa-z0-9_])(сказал|сказала|говорил|говорила|писал|писала|спросил|спросила)(^|[^а-яёa-z0-9_])/i.test(text)
}

function looksConditional(text) {
  const source = String(text || '').toLowerCase().replace(/ё/g, 'е').trim()
  if (!source) return false

  if (/^если\s+уж\s+совсем\s+прямо\s+говорить/.test(source)) return false
  if (/^если\s+честно/.test(source)) return false
  if (/^если\s+прямо\s+говорить/.test(source)) return false

  return /(^|[^а-яёa-z0-9_])(если|если бы|когда-нибудь если)([^а-яёa-z0-9_]|$)/i.test(source)
}

function looksHypothetical(text) {
  const source = String(text || '').toLowerCase().replace(/ё/g, 'е').trim()
  if (!source) return false

  if (/^если\s+уж\s+совсем\s+прямо\s+говорить/.test(source)) return false
  if (/^если\s+честно/.test(source)) return false
  if (/^если\s+прямо\s+говорить/.test(source)) return false

  return /(^|[^а-яёa-z0-9_])(будто|словно|как будто|мог бы|могла бы|если бы)([^а-яёa-z0-9_]|$)/i.test(source)
}

function looksImperative(text) {
  return /(^|[^а-яёa-z0-9_])(давай|сделай|не трогай|посмотри|запомни|прекрати)(^|[^а-яёa-z0-9_])/i.test(text)
}

function looksHedged(text) {
  return /(^|[^а-яёa-z0-9_])(кажется|наверное|может|может быть|пожалуй|как будто)(^|[^а-яёa-z0-9_])/i.test(text)
}

function buildClauseContext(clause, event) {
  const text = clause.clauseText

  return {
    sourceEventId: event.id,
    timestamp: event.timestamp,
    threadId: event.threadId,
    world: event.world || 'Earth',
    platform: event.platform || 'telegram',
    channel: event.channel || 'text',
    actorRole: event.role || 'user',
    unitKind: clause.kind,
    unitId: clause.id,
    clauseId: clause.clauseId,
    isRp: clause.kind === 'rp',
    isQuestion: hasQuestion(text),
    hasNegation: hasNegation(text),
    hasQuote: hasQuote(text),
    isReported: looksReported(text),
    isConditional: looksConditional(text),
    isHypothetical: looksHypothetical(text),
    isImperative: looksImperative(text),
    isHedged: looksHedged(text),
    order: clause.order
  }
}

module.exports = {
  buildClauseContext
}