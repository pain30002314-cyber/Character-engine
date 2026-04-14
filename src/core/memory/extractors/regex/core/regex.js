'use strict'

const ALNUM_CLASS = 'а-яёa-z0-9_'

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizePhraseSpacing(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function buildLooseSpacePattern(value) {
  return escapeRegExp(normalizePhraseSpacing(value)).replace(/ /g, '\\s+')
}

function buildBoundaryPattern(phrase) {
  const source = buildLooseSpacePattern(phrase)
  return `(^|[^${ALNUM_CLASS}])${source}([^${ALNUM_CLASS}]|$)`
}

function phraseRegex(phrase, flags = 'i') {
  return new RegExp(buildBoundaryPattern(phrase), flags)
}

function exactUnitRegex(phrase, flags = 'i') {
  const source = buildLooseSpacePattern(phrase)
  return new RegExp(`^\\s*${source}\\s*[.!?…,:;-]*\\s*$`, flags)
}

function anyPhraseRegex(phrases, flags = 'i') {
  const source = (phrases || [])
    .map((item) => `(?:${buildBoundaryPattern(item)})`)
    .join('|')

  return new RegExp(source, flags)
}

function includesPhrase(text, phrase) {
  return phraseRegex(phrase).test(String(text || ''))
}

module.exports = {
  ALNUM_CLASS,
  escapeRegExp,
  normalizePhraseSpacing,
  buildLooseSpacePattern,
  buildBoundaryPattern,
  phraseRegex,
  exactUnitRegex,
  anyPhraseRegex,
  includesPhrase
}