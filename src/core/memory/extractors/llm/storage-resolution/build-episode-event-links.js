'use strict'

const { buildResolutionId } = require('./helpers')

function buildEpisodeEventLinks({
  candidatePool = {},
  episodeResolutions = []
} = {}) {
  return (Array.isArray(episodeResolutions) ? episodeResolutions : []).map(
    (item, index) => ({
      linkId: buildResolutionId(
        'episode_event_link',
        {
          candidateId: item?.candidateId || `candidate:${index}`
        },
        item?.episodeResolutionId || 'episode'
      ),
      episodeResolutionId: item?.episodeResolutionId || null,
      candidateId: item?.candidateId || null,
      traceId: item?.provenance?.traceId || candidatePool?.traceId || null,
      threadId: item?.provenance?.threadId || candidatePool?.threadId || null,
      eventId: item?.provenance?.eventId || candidatePool?.eventId || null,
      linkRole: 'origin',
      positionIndex: index,
      provenance: item?.provenance || null
    })
  )
}

module.exports = {
  buildEpisodeEventLinks
}
