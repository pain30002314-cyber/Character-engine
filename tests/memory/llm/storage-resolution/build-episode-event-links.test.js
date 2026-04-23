'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildEpisodeEventLinks } = require('../../../../src/core/memory/extractors/llm/storage-resolution/build-episode-event-links')

test('buildEpisodeEventLinks links episode resolutions to event id', () => {
  const result = buildEpisodeEventLinks({
    candidatePool: {
      eventId: 'evt-1'
    },
    episodeResolutions: [
      {
        episodeResolutionId: 'episode-1'
      }
    ]
  })

  assert.equal(result[0].eventId, 'evt-1')
  assert.equal(result[0].positionIndex, 0)
})
