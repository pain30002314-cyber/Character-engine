'use strict'

const {
  LLM_EXTRACTOR_PASSES,
  getExtractorPassConfigByKey
} = require('../config/extractor-passes.config')
const {
  runEntityObjectLocationPass
} = require('./entity-object-location.pass')
const { runFactPass } = require('./fact.pass')
const { runEpisodePass } = require('./episode.pass')
const { runPhaseOpenLoopPass } = require('./phase-open-loop.pass')
const { runCognitionRealizationPass } = require('./cognition-realization.pass')
const {
  runEmotionAtmosphereSignificancePass
} = require('./emotion-atmosphere-significance.pass')
const { runRelationshipSocialPass } = require('./relationship-social.pass')

const PASS_MODULE_BY_KEY = Object.freeze({
  'entity-object-location': runEntityObjectLocationPass,
  fact: runFactPass,
  episode: runEpisodePass,
  'phase-open-loop': runPhaseOpenLoopPass,
  'cognition-realization': runCognitionRealizationPass,
  'emotion-atmosphere-significance': runEmotionAtmosphereSignificancePass,
  'relationship-social': runRelationshipSocialPass
})

function buildRegisteredPass(pass) {
  const execute = PASS_MODULE_BY_KEY[pass.extractorKey]

  return {
    order: pass.order,
    extractorKey: pass.extractorKey,
    extractorName: pass.extractorName,
    role: pass.role,
    enabled: pass.enabled !== false,
    execute
  }
}

function getRegisteredExtractorPasses(options = {}) {
  const includeDisabled = options?.includeDisabled === true

  return LLM_EXTRACTOR_PASSES
    .filter((pass) => includeDisabled || pass.enabled !== false)
    .sort((left, right) => left.order - right.order)
    .map(buildRegisteredPass)
}

function getExtractorPassByKey(extractorKey) {
  const normalizedKey = String(extractorKey || '').trim()

  if (!normalizedKey) {
    return null
  }

  const pass = getExtractorPassConfigByKey(normalizedKey)

  return pass ? buildRegisteredPass(pass) : null
}

module.exports = {
  getRegisteredExtractorPasses,
  getExtractorPassByKey,
  PASS_MODULE_BY_KEY
}
