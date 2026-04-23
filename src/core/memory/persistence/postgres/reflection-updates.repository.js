'use strict'

const {
  buildInsertStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createReflectionUpdatesRepository({ client } = {}) {
  async function createReflectionUpdate(update = {}) {
    const statement = buildInsertStatement(
      'reflection_updates',
      update,
      {
        onConflict: ' ON CONFLICT (id) DO NOTHING'
      }
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  return {
    createReflectionUpdate
  }
}

module.exports = {
  createReflectionUpdatesRepository
}
