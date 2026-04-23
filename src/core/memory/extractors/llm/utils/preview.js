'use strict'

const { trimText } = require('./text')

function buildTextPreview(value, maxLength = 280) {
  return trimText(value, maxLength)
}

function buildJsonPreview(value, maxLength = 280) {
  try {
    return trimText(JSON.stringify(value), maxLength)
  } catch (error) {
    return `preview_unavailable:${error.message}`
  }
}

module.exports = {
  buildTextPreview,
  buildJsonPreview
}
