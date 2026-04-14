'use strict'

const { runLlmExtractor } = require('./runtime')

async function extractLlmAtomsV1(input) {
  return runLlmExtractor(input)
}

// временный alias, чтобы ничего не развалилось,
// если где-то ещё осталось старое имя
async function extractLlmClaims(input) {
  return runLlmExtractor(input)
}

module.exports = {
  extractLlmAtomsV1,
  extractLlmClaims
}