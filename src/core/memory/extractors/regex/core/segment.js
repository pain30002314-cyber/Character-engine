'use strict'

const { normalizeText } = require('./preprocess')

function isGarbageSentence(text) {
  const source = normalizeText(text)

  if (!source) return true
  if (/^[.?!,:;\-–—…\s]+$/.test(source)) return true

  const compact = source.replace(/\s+/g, '')
  if (!compact) return true
  if (/^[.?!,:;\-–—…]+$/.test(compact)) return true

  return false
}

function splitWithBoundaryMarkers(text) {
  const source = normalizeText(text)
  if (!source) return []

  const marked = source
    .replace(
      /\s+(И да[, ]|Но пока[, ]|Так что[, ]|И не путай[, ]|А там[, ]|Ага[, ]|Неа[, ]|Зато[, ]|При этом[, ]|Вообще[, ]|Короче[, ])/giu,
      '\n$1'
    )
    .replace(/\.\s+(Но|И|Так что|А|Неа|Ага|Зато|При этом|Вообще|Короче)\s+/giu, (m, p1) => `.\n${p1} `)
    .replace(/([.!?…])\s+(Зато|Но|А|При этом|Вообще|Короче)\s+/giu, (m, p1, p2) => `${p1}\n${p2} `)

  return marked
    .split(/\n+/)
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

function splitLongTechnicalClause(text) {
  const source = normalizeText(text)
  if (!source) return []

  const lowered = source.toLowerCase()

  const looksTechnical =
    /(^|[^а-яёa-z0-9_])(llm|regex|json|api|extractor|pipeline|mem0|снапшот|лог|логи|экстрактор|мердж)([^а-яёa-z0-9_]|$)/i.test(source)

  if (!looksTechnical || source.length < 160) {
    return [source]
  }

  const marked = source
    .replace(/\s+(зато)\s+/giu, '\n$1 ')
    .replace(/\s+(но)\s+/giu, '\n$1 ')
    .replace(/\s+(а)\s+/giu, '\n$1 ')
    .replace(/\s+(при этом)\s+/giu, '\n$1 ')
    .replace(/\s+(потому что)\s+/giu, '\n$1 ')
    .replace(/\s+(к сожалению)\s+/giu, '\n$1 ')
    .replace(/\s+(по сути)\s+/giu, '\n$1 ')
    .replace(/\s+(в целом)\s+/giu, '\n$1 ')

  const parts = marked
    .split(/\n+/)
    .map((item) => normalizeText(item))
    .filter(Boolean)

  if (parts.length <= 1) {
    return [source]
  }

  return parts
}

function splitPlainTextIntoClauses(text) {
  const source = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim()

  if (!source) return []

  const protectedText = source
    .replace(/\.\.\./g, '…')
    .replace(/([!?]){2,}/g, '$1')

  const rawSentenceParts = protectedText
    .split(/(?<=[.!?…])\s+(?=[A-ZА-ЯЁ0-9"*«„])/u)
    .flatMap((part) => part.split(/\n+/))
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .filter((part) => !isGarbageSentence(part))

  const clauses = []

  for (const part of rawSentenceParts) {
    const boundaryParts = splitWithBoundaryMarkers(part)

    const firstLevel =
      boundaryParts.length <= 1
        ? [part]
        : boundaryParts

    for (const boundaryPart of firstLevel) {
      const commaSplit = boundaryPart.includes('?')
        ? [boundaryPart]
        : boundaryPart
            .split(/(?:(?<=,)\s+(?=но\s)|(?<=,)\s+(?=а\s))/iu)
            .map((item) => normalizeText(item))
            .filter(Boolean)
            .filter((item) => !isGarbageSentence(item))

      const secondLevel = commaSplit.length > 0 ? commaSplit : [boundaryPart]

      for (const item of secondLevel) {
        const technicalSplit = splitLongTechnicalClause(item)

        for (const sub of technicalSplit) {
          const normalized = normalizeText(sub)
          if (!normalized || isGarbageSentence(normalized)) continue
          clauses.push(normalized)
        }
      }
    }
  }

  return clauses
}

function extractRpBlocks(text) {
  const source = String(text || '')
  const blocks = []
  const regex = /\*([^*\n][\s\S]*?)\*/g
  let match

  while ((match = regex.exec(source)) !== null) {
    const raw = normalizeText(match[1])
    if (!raw) continue

    blocks.push({
      text: raw,
      start: match.index,
      end: match.index + match[0].length
    })
  }

  return blocks
}

function stripRpBlocks(text) {
  return normalizeText(String(text || '').replace(/\*([^*\n][\s\S]*?)\*/g, ' '))
}

function buildUnits(preprocessed) {
  const rawText = preprocessed?.rawText || preprocessed?.text || ''
  const rpBlocks = extractRpBlocks(rawText)

  const units = []
  let order = 0

  for (const block of rpBlocks) {
    units.push({
      id: `unit_rp_${order + 1}`,
      kind: 'rp',
      order: order + 1,
      text: block.text,
      normalizedText: normalizeText(block.text).toLowerCase()
    })
    order += 1
  }

  const plainText = stripRpBlocks(rawText)
  const plainClauses = splitPlainTextIntoClauses(plainText)

  for (const clauseText of plainClauses) {
    units.push({
      id: `unit_plain_${order + 1}`,
      kind: 'plain',
      order: order + 1,
      text: clauseText,
      normalizedText: normalizeText(clauseText).toLowerCase()
    })
    order += 1
  }

  return units
}

function enrichClauses(units) {
  const clauses = []
  let clauseIndex = 0

  for (const unit of units || []) {
    const unitText = normalizeText(unit.text)
    if (!unitText) continue

    const pieces =
      unit.kind === 'rp'
        ? [unitText]
        : splitPlainTextIntoClauses(unitText)

    for (const piece of pieces) {
      const clauseText = normalizeText(piece)
      if (!clauseText || isGarbageSentence(clauseText)) continue

      clauseIndex += 1

      clauses.push({
        id: unit.id,
        kind: unit.kind,
        order: unit.order,

        clauseId: `clause_${clauseIndex}`,

        text: unitText,
        normalizedText: normalizeText(unitText).toLowerCase(),

        unitText,
        unitNormalizedText: normalizeText(unitText).toLowerCase(),

        clauseText,
        clauseNormalizedText: normalizeText(clauseText).toLowerCase()
      })
    }
  }

  return clauses
}

module.exports = {
  buildUnits,
  enrichClauses,
  splitPlainTextIntoClauses,
  isGarbageSentence
}