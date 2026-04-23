'use strict'

const {
  buildUpsertStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createLocationProfilesRepository({ client } = {}) {
  async function upsertLocationProfile(profile = {}) {
    const statement = buildUpsertStatement(
      'location_profiles',
      profile,
      ['node_id']
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  return {
    upsertLocationProfile
  }
}

module.exports = {
  createLocationProfilesRepository
}
