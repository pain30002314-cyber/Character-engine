'use strict'

const { getExtractorPassConfigByKey } = require('../config/extractor-passes.config')
const { runSingleExtractorPass } = require('../shared/run-single-pass')

const RELATIONSHIP_SOCIAL_PASS = getExtractorPassConfigByKey('relationship-social')

async function runRelationshipSocialPass(input = {}) {
  return runSingleExtractorPass({
    ...input,
    pass: RELATIONSHIP_SOCIAL_PASS
  })
}

module.exports = {
  RELATIONSHIP_SOCIAL_PASS,
  runRelationshipSocialPass
}
