function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function buildCanonicalKey(parts) {
  return parts
    .map((part) => slugify(part))
    .filter(Boolean)
    .join('__')
}

function makeCanonicalItemId(schema, key) {
  return `${schema}:${key}`
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

module.exports = {
  normalizeText,
  slugify,
  buildCanonicalKey,
  makeCanonicalItemId,
  safeArray
}