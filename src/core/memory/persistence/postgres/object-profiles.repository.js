'use strict'

const {
  buildUpsertStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createObjectProfilesRepository({ client } = {}) {
  async function upsertObjectProfile(profile = {}) {
    const statement = buildUpsertStatement(
      'object_profiles',
      profile,
      ['node_id']
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  return {
    upsertObjectProfile
  }
}

module.exports = {
  createObjectProfilesRepository
}
