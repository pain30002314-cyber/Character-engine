'use strict'

const {
  buildUpsertStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createEntityProfilesRepository({ client } = {}) {
  async function upsertEntityProfile(profile = {}) {
    const statement = buildUpsertStatement(
      'entity_profiles',
      profile,
      ['node_id']
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  return {
    upsertEntityProfile
  }
}

module.exports = {
  createEntityProfilesRepository
}
