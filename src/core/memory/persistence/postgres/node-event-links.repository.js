'use strict'

const {
  buildInsertStatement,
  runQuery,
  rowCount,
  pickRow
} = require('./repository.helpers')

function createNodeEventLinksRepository({ client } = {}) {
  async function createNodeEventLink(link = {}) {
    const statement = buildInsertStatement(
      'node_event_links',
      link,
      {
        onConflict: ' ON CONFLICT DO NOTHING'
      }
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function createNodeEventLinks(links = []) {
    let created = 0

    for (const link of Array.isArray(links) ? links : []) {
      const statement = buildInsertStatement(
        'node_event_links',
        link,
        {
          onConflict: ' ON CONFLICT DO NOTHING'
        }
      )
      const result = await runQuery(statement, { client })
      created += rowCount(result)
    }

    return created
  }

  return {
    createNodeEventLink,
    createNodeEventLinks
  }
}

module.exports = {
  createNodeEventLinksRepository
}
