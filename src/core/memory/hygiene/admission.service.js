const { RAW_CLAIM_TYPE } = require('../../../shared/memory.types')

const META_HEADING_RE = /^[A-ZА-ЯЁ][A-ZА-ЯЁ\s_-]{4,}$/m
const BULLET_LINE_RE = /^\s*[-•]\s+/m
const ENUM_RULE_RE = /^\s*\d+[.)]\s+/m

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim()
}

function wordCount(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter(Boolean).length
}

function lineCount(text) {
  return normalizeText(text)
    .split('\n')
    .filter((line) => line.trim().length > 0).length
}

function sentenceCount(text) {
  const matches = normalizeText(text).match(/[.!?…]+/g)
  return matches ? matches.length : 0
}

function looksLikeMetaInstructionBlock(text) {
  const source = normalizeText(text)

  if (!source) return false

  const lines = lineCount(source)
  const words = wordCount(source)

  const hasMetaHeading = META_HEADING_RE.test(source)
  const hasBullets = BULLET_LINE_RE.test(source)
  const hasEnum = ENUM_RULE_RE.test(source)

  const quotedImperatives = /не\s+\S+|только\s+\S+|должн\w+\s+\S+/i.test(source)

  if (lines >= 8 && (hasBullets || hasEnum)) {
    return true
  }

  if (hasMetaHeading && lines >= 6) {
    return true
  }

  if (words >= 120 && (hasBullets || hasEnum || quotedImperatives)) {
    return true
  }

  return false
}

function looksLikeContaminatedAssistantEvent(event) {
  if (!event || event.role !== 'assistant') {
    return false
  }

  return looksLikeMetaInstructionBlock(event.text)
}

function hasTooMuchStructure(text) {
  const source = normalizeText(text)

  if (!source) return false

  const lines = lineCount(source)
  const bullets = (source.match(/^\s*[-•]\s+/gm) || []).length
  const enums = (source.match(/^\s*\d+[.)]\s+/gm) || []).length

  return lines >= 6 && bullets + enums >= 3
}

function isLikelyEntityName(text) {
  const source = normalizeText(text)

  if (!source) return false
  if (source.length > 80) return false
  if (sentenceCount(source) > 0) return false
  if (hasTooMuchStructure(source)) return false
  if (/[:;!?()[\]{}]/.test(source)) return false
  if (/\s—\s|\s-\s/.test(source)) return false

  const words = source.split(/\s+/).filter(Boolean)

  if (words.length === 0 || words.length > 5) {
    return false
  }

  const longWordCount = words.filter((word) => word.length >= 2).length
  if (longWordCount === 0) {
    return false
  }

  return true
}

function isLikelyFactText(text) {
  const source = normalizeText(text)

  if (!source) return false
  if (source.length < 8 || source.length > 400) return false
  if (hasTooMuchStructure(source)) return false
  if (looksLikeMetaInstructionBlock(source)) return false

  return true
}

function isLikelyRelationshipText(text) {
  const source = normalizeText(text)

  if (!source) return false
  if (source.length < 8 || source.length > 280) return false
  if (hasTooMuchStructure(source)) return false
  if (looksLikeMetaInstructionBlock(source)) return false

  return true
}

function isLikelyOpenLoopText(text) {
  const source = normalizeText(text)

  if (!source) return false
  if (source.length < 6 || source.length > 240) return false
  if (hasTooMuchStructure(source)) return false
  if (looksLikeMetaInstructionBlock(source)) return false

  return true
}

function isLikelyEpisodeText(text) {
  const source = normalizeText(text)

  if (!source) return false
  if (source.length < 8 || source.length > 280) return false
  if (hasTooMuchStructure(source)) return false
  if (looksLikeMetaInstructionBlock(source)) return false

  return true
}

function isClaimAdmissible(claim) {
  if (!claim || !claim.claimType) {
    return false
  }

  const text = normalizeText(claim.text)

  if (!text) {
    return false
  }

  switch (claim.claimType) {
    case RAW_CLAIM_TYPE.ENTITY:
      return isLikelyEntityName(text)

    case RAW_CLAIM_TYPE.FACT:
      return isLikelyFactText(text)

    case RAW_CLAIM_TYPE.RELATIONSHIP:
      return isLikelyRelationshipText(text)

    case RAW_CLAIM_TYPE.OPEN_LOOP:
      return isLikelyOpenLoopText(text)

    case RAW_CLAIM_TYPE.EPISODE:
      return isLikelyEpisodeText(text)

    default:
      return false
  }
}

function filterAdmissibleClaims(claims) {
  return (claims || []).filter(isClaimAdmissible)
}

function buildSanitizedCanonicalPreview(items, limit = 8) {
  return (items || [])
    .filter((item) => item?.payload)
    .filter((item) => {
      const text =
        item.payload?.text ||
        item.payload?.summary ||
        item.payload?.name ||
        item.key ||
        ''

      if (!text) return false
      if (looksLikeMetaInstructionBlock(text)) return false

      if (item.schema === 'entity') {
        return isLikelyEntityName(text)
      }

      return isLikelyFactText(text) || isLikelyRelationshipText(text) || isLikelyOpenLoopText(text)
    })
    .slice(0, limit)
    .map((item) => ({
      schema: item.schema,
      key: item.key,
      payload: item.payload
    }))
}

module.exports = {
  looksLikeMetaInstructionBlock,
  looksLikeContaminatedAssistantEvent,
  isClaimAdmissible,
  filterAdmissibleClaims,
  buildSanitizedCanonicalPreview
}