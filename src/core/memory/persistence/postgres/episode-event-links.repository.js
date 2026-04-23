'use strict'

const {
  buildInsertStatement,
  runQuery,
  rowCount,
  pickRow
} = require('./repository.helpers')

function createEpisodeEventLinksRepository({ client } = {}) {
  async function createEpisodeEventLink(link = {}) {
    const statement = buildInsertStatement(
      'episode_event_links',
      link,
      {
        onConflict: ' ON CONFLICT DO NOTHING'
      }
    )
    const result = await runQuery(statement, { client })
    return pickRow(result)
  }

  async function createEpisodeEventLinks(links = []) {
    let created = 0

    for (const link of Array.isArray(links) ? links : []) {
      const statement = buildInsertStatement(
        'episode_event_links',
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
    createEpisodeEventLink,
    createEpisodeEventLinks
  }
}

module.exports = {
  createEpisodeEventLinksRepository
}
