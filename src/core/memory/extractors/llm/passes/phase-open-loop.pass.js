'use strict'

const { getExtractorPassConfigByKey } = require('../config/extractor-passes.config')
const { runSingleExtractorPass } = require('../shared/run-single-pass')

const PHASE_OPEN_LOOP_PASS = getExtractorPassConfigByKey('phase-open-loop')

async function runPhaseOpenLoopPass(input = {}) {
  return runSingleExtractorPass({
    ...input,
    pass: PHASE_OPEN_LOOP_PASS
  })
}

module.exports = {
  PHASE_OPEN_LOOP_PASS,
  runPhaseOpenLoopPass
}
