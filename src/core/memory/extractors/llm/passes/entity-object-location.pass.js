'use strict'

const { getExtractorPassConfigByKey } = require('../config/extractor-passes.config')
const { runSingleExtractorPass } = require('../shared/run-single-pass')

const ENTITY_OBJECT_LOCATION_PASS = getExtractorPassConfigByKey('entity-object-location')

async function runEntityObjectLocationPass(input = {}) {
  return runSingleExtractorPass({
    ...input,
    pass: ENTITY_OBJECT_LOCATION_PASS
  })
}

module.exports = {
  ENTITY_OBJECT_LOCATION_PASS,
  runEntityObjectLocationPass
}
