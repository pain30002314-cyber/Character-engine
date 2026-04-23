'use strict'

const {
  buildInsertStatement,
  buildUpdateStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createDerivedSnapshotsRepository({ client } = {}) {
  async function createDerivedSnapshot(snapshot = {}) {
    const statement = buildInsertStatement(
      'derived_snapshots',
      snapshot,
      {
        onConflict: ' ON CONFLICT (id) DO NOTHING'
      }
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function supersedeSnapshot(id, timestamp) {
    const statement = buildUpdateStatement(
      'derived_snapshots',
      {
        superseded_at: timestamp
      },
      {
        id
      }
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  return {
    createDerivedSnapshot,
    supersedeSnapshot
  }
}

module.exports = {
  createDerivedSnapshotsRepository
}
