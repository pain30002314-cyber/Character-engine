'use strict'

const env = require('../../../../config/env')

const DEFAULT_FILTER_CONFIG = {
  model: env.memoryModel || null,
  temperature: 0,
  maxTokens: 5000,
  title: 'Hu Tao LLM Candidate Filter Evaluator'
}

function getLlmFilterConfig(overrides = {}) {
  return {
    ...DEFAULT_FILTER_CONFIG,
    ...(overrides || {})
  }
}

module.exports = {
  DEFAULT_FILTER_CONFIG,
  getLlmFilterConfig
}