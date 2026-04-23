'use strict'

const { ROUTING_TARGETS } = require('../lifecycle/lifecycle-routing-targets')
const {
  getCandidatesByTarget,
  pickFirstText,
  pickStringList,
  coerceImportanceSeed,
  buildResolutionId,
  buildPacketProvenance,
  buildSummarySeeds,
  buildConfidenceSeed,
  extractPayloadList,
  sanitizeTagList
} = require('./helpers')

function resolveEpisodeType(candidate) {
  switch (candidate?.kind) {
    case 'scene_candidate':
      return 'scene'
    case 'micro_scene_candidate':
    case 'micro_episode_candidate':
      return 'micro_scene'
    case 'interaction_candidate':
      return 'interaction'
    case 'progression_signal':
      return 'progression'
    default:
      return 'episode'
  }
}

function resolveEpisodeCandidates(candidatePool = {}) {
  return getCandidatesByTarget(candidatePool, ROUTING_TARGETS.EPISODE_RESOLUTION).map(
    (candidate) => {
      const payload = candidate?.payload || {}
      const summarySeeds = buildSummarySeeds(candidate)

      return {
        episodeResolutionId: buildResolutionId(
          'episode_resolution',
          candidate,
          candidate?.kind || 'episode'
        ),
        candidateId: candidate?.candidateId || candidate?.id || null,
        candidateKind: candidate?.kind || null,
        episodeType: resolveEpisodeType(candidate),
        titleSeed: summarySeeds.summaryShort,
        summaryShortSeed: summarySeeds.summaryShort,
        summaryLongSeed: summarySeeds.summaryLong,
        startedAtHints: pickStringList(
          payload.startedAt,
          payload.startAt,
          candidate?.temporal?.start,
          candidate?.timestamp_iso
        ),
        endedAtHints: pickStringList(
          payload.endedAt,
          payload.endAt,
          candidate?.temporal?.end
        ),
        locationHints: extractPayloadList(payload, ['location', 'locationName', 'place', 'places']),
        participantHints: extractPayloadList(payload, [
          'participants',
          'participantNames',
          'people',
          'entities',
          'actors'
        ]),
        atmosphereSeeds: pickStringList(
          payload.atmosphere,
          payload.tone,
          payload.mood,
          payload.shift,
          sanitizeTagList(candidate?.tags, 8)
        ),
        sourceEventCountSeed: 1,
        importanceSeed: coerceImportanceSeed(candidate?.importance),
        confidenceSeed: buildConfidenceSeed(candidate),
        provenance: buildPacketProvenance(candidate, candidatePool)
      }
    }
  )
}

module.exports = {
  resolveEpisodeCandidates
}
