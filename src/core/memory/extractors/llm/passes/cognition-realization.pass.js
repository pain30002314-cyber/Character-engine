'use strict'

const { getExtractorPassConfigByKey } = require('../config/extractor-passes.config')
const { runSingleExtractorPass } = require('../shared/run-single-pass')

const COGNITION_REALIZATION_PASS = getExtractorPassConfigByKey('cognition-realization')

async function runCognitionRealizationPass(input = {}) {
  return runSingleExtractorPass({
    ...input,
    pass: COGNITION_REALIZATION_PASS
  })
}

module.exports = {
  COGNITION_REALIZATION_PASS,
  runCognitionRealizationPass
}
