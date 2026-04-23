'use strict'

const { getExtractorPassConfigByKey } = require('../config/extractor-passes.config')
const { runSingleExtractorPass } = require('../shared/run-single-pass')

const EPISODE_PASS = getExtractorPassConfigByKey('episode')

async function runEpisodePass(input = {}) {
  return runSingleExtractorPass({
    ...input,
    pass: EPISODE_PASS
  })
}

module.exports = {
  EPISODE_PASS,
  runEpisodePass
}
