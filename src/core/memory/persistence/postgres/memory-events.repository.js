'use strict'

const {
  buildInsertStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createMemoryEventsRepository({ client } = {}) {
  async function createMemoryEvent(event = {}) {
    const statement = buildInsertStatement(
      'memory_events',
      event,
      {
        onConflict: ' ON CONFLICT (id) DO NOTHING'
      }
    )

    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function getMemoryEventById(id) {
    const result = await runQuery(
      {
        text: 'SELECT * FROM memory_events WHERE id = $1 LIMIT 1',
        values: [id]
      },
      { client }
    )

    return pickRow(result)
  }

  return {
    createMemoryEvent,
    getMemoryEventById
  }
}

module.exports = {
  createMemoryEventsRepository
}
