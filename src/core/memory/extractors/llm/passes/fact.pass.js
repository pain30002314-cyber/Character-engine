'use strict'

const { getExtractorPassConfigByKey } = require('../config/extractor-passes.config')
const { runSingleExtractorPass } = require('../shared/run-single-pass')

const FACT_PASS = getExtractorPassConfigByKey('fact')

async function runFactPass(input = {}) {
  return runSingleExtractorPass({
    ...input,
    pass: FACT_PASS
  })
}

module.exports = {
  FACT_PASS,
  runFactPass
}
