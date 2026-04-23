'use strict'

const {
  buildInsertStatement,
  buildUpdateStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createEpisodeRecordsRepository({ client } = {}) {
  async function createEpisodeRecord(episode = {}) {
    const statement = buildInsertStatement(
      'episode_records',
      episode,
      {
        onConflict: ' ON CONFLICT (node_id) DO NOTHING'
      }
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function updateEpisodeRecord(nodeId, patch = {}) {
    const statement = buildUpdateStatement('episode_records', patch, { node_id: nodeId })
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  return {
    createEpisodeRecord,
    updateEpisodeRecord
  }
}

module.exports = {
  createEpisodeRecordsRepository
}
