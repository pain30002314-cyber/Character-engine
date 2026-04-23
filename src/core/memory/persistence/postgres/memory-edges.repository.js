'use strict'

const {
  buildInsertStatement,
  buildUpdateStatement,
  runQuery,
  pickRow
} = require('./repository.helpers')

function createMemoryEdgesRepository({ client } = {}) {
  async function createMemoryEdge(edge = {}) {
    const statement = buildInsertStatement(
      'memory_edges',
      edge,
      {
        onConflict: ' ON CONFLICT (id) DO NOTHING'
      }
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function updateMemoryEdge(id, patch = {}) {
    const statement = buildUpdateStatement('memory_edges', patch, { id })
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function findSimilarEdge(edge = {}) {
    const result = await runQuery(
      {
        text:
          'SELECT * FROM memory_edges WHERE from_node_id = $1 AND to_node_id = $2 AND edge_type = $3 LIMIT 1',
        values: [edge.from_node_id || null, edge.to_node_id || null, edge.edge_type || null]
      },
      { client }
    )

    return pickRow(result)
  }

  return {
    createMemoryEdge,
    updateMemoryEdge,
    findSimilarEdge
  }
}

module.exports = {
  createMemoryEdgesRepository
}
