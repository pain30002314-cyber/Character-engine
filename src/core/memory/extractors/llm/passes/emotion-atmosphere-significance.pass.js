'use strict'

const { getExtractorPassConfigByKey } = require('../config/extractor-passes.config')
const { runSingleExtractorPass } = require('../shared/run-single-pass')

const EMOTION_ATMOSPHERE_SIGNIFICANCE_PASS = getExtractorPassConfigByKey('emotion-atmosphere-significance')

async function runEmotionAtmosphereSignificancePass(input = {}) {
  return runSingleExtractorPass({
    ...input,
    pass: EMOTION_ATMOSPHERE_SIGNIFICANCE_PASS
  })
}

module.exports = {
  EMOTION_ATMOSPHERE_SIGNIFICANCE_PASS,
  runEmotionAtmosphereSignificancePass
}
