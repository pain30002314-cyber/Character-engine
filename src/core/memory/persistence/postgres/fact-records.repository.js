'use strict'

const {
  buildInsertStatement,
  buildUpdateStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createFactRecordsRepository({ client } = {}) {
  async function createFactRecord(fact = {}) {
    const statement = buildInsertStatement(
      'fact_records',
      fact,
      {
        onConflict: ' ON CONFLICT (node_id) DO NOTHING'
      }
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function updateFactRecord(nodeId, patch = {}) {
    const statement = buildUpdateStatement('fact_records', patch, { node_id: nodeId })
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function markFactSupported(nodeId, timestamp) {
    return updateFactRecord(nodeId, {
      last_supported_at: timestamp
    })
  }

  async function markFactContradicted(nodeId, timestamp) {
    return updateFactRecord(nodeId, {
      last_contradicted_at: timestamp
    })
  }

  return {
    createFactRecord,
    updateFactRecord,
    markFactSupported,
    markFactContradicted
  }
}

module.exports = {
  createFactRecordsRepository
}
