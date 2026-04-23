'use strict'

const {
  buildInsertStatement,
  buildUpdateStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createMemoryNodesRepository({ client } = {}) {
  async function createMemoryNode(node = {}) {
    const statement = buildInsertStatement(
      'memory_nodes',
      node,
      {
        onConflict: ' ON CONFLICT (id) DO NOTHING'
      }
    )

    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function updateMemoryNode(id, patch = {}) {
    const statement = buildUpdateStatement('memory_nodes', patch, { id })
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function findMemoryNodeById(id) {
    const result = await runQuery(
      {
        text: 'SELECT * FROM memory_nodes WHERE id = $1 LIMIT 1',
        values: [id]
      },
      { client }
    )

    return pickRow(result)
  }

  async function markMemoryNodeStatus(id, status) {
    return updateMemoryNode(id, {
      status,
      last_updated_at: new Date().toISOString()
    })
  }

  return {
    createMemoryNode,
    updateMemoryNode,
    findMemoryNodeById,
    markMemoryNodeStatus
  }
}

module.exports = {
  createMemoryNodesRepository
}
