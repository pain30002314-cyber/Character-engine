'use strict'

function isWeakGarbage(text) {
  const source = String(text || '').trim()
  if (!source) return true
  if (source.length <= 1) return true
  if (/^(ну|ага|ок|ладно|ясно|понятно)$/i.test(source)) return true
  if (/^[?!.…,-]+$/.test(source)) return true
  return false
}

function filterWeakCandidates(candidates) {
  return (candidates || []).filter((item) => !isWeakGarbage(item?.text))
}

module.exports = {
  isWeakGarbage,
  filterWeakCandidates
}