'use strict'

const { ROUTING_TARGETS } = require('../lifecycle/lifecycle-routing-targets')
const { resolveNodeCandidates } = require('./resolve-node-candidates')
const { resolveFactCandidates } = require('./resolve-fact-candidates')
const { resolveEpisodeCandidates } = require('./resolve-episode-candidates')
const { resolveEdgeCandidates } = require('./resolve-edge-candidates')
const { buildNodeEventLinks } = require('./build-node-event-links')
const { buildEpisodeEventLinks } = require('./build-episode-event-links')
const { buildProfileUpdates } = require('./build-profile-updates')
const { buildDerivedInput } = require('./build-derived-input')
const {
  safeArray,
  hasRoutingTarget,
  buildResolutionId,
  buildPacketProvenance,
  buildSummarySeeds
} = require('./helpers')

function buildReflectionInput(candidatePool = {}) {
  return safeArray(candidatePool?.candidates)
    .filter((candidate) => hasRoutingTarget(candidate, ROUTING_TARGETS.REFLECTION_QUEUE))
    .map((candidate) => {
      const summarySeeds = buildSummarySeeds(candidate)

      return {
        reflectionInputId: buildResolutionId(
          'reflection_input',
          candidate,
          candidate?.kind || 'reflection'
        ),
        candidateId: candidate?.candidateId || candidate?.id || null,
        candidateKind: candidate?.kind || null,
        summarySeed: summarySeeds.summaryShort,
        textSeed: summarySeeds.summaryLong,
        provenance: buildPacketProvenance(candidate, candidatePool)
      }
    })
}

function buildPersistencePacket(candidatePool = {}) {
  const nodeResolutions = resolveNodeCandidates(candidatePool)
  const factResolutions = resolveFactCandidates(candidatePool)
  const episodeResolutions = resolveEpisodeCandidates(candidatePool)
  const edgeResolutions = resolveEdgeCandidates(candidatePool)
  const nodeEventLinks = buildNodeEventLinks({
    candidatePool,
    nodeResolutions
  })
  const episodeEventLinks = buildEpisodeEventLinks({
    candidatePool,
    episodeResolutions
  })
  const profileUpdates = buildProfileUpdates({
    nodeResolutions
  })
  const derivedInput = buildDerivedInput(candidatePool)
  const reflectionInput = buildReflectionInput(candidatePool)
  const warnings = []

  if (safeArray(candidatePool?.candidates).length === 0) {
    warnings.push('candidate_pool_empty_for_storage_resolution')
  }

  return {
    traceId: candidatePool?.traceId || null,
    eventId: candidatePool?.eventId || null,
    threadId: candidatePool?.threadId || null,
    rawEvent: candidatePool?.rawEvent || null,
    sourceLifecycleStatus: 'routed',
    nodes: nodeResolutions,
    entityProfiles: profileUpdates.entities,
    objectProfiles: profileUpdates.objects,
    locationProfiles: profileUpdates.locations,
    facts: factResolutions,
    episodes: episodeResolutions,
    edges: edgeResolutions,
    derivedSnapshots: derivedInput,
    reflectionUpdates: reflectionInput,
    nodeResolutions,
    profileUpdates,
    factResolutions,
    episodeResolutions,
    edgeResolutions,
    nodeEventLinks,
    episodeEventLinks,
    derivedInput,
    reflectionInput,
    resolutionMeta: {
      nodeCount: nodeResolutions.length,
      factCount: factResolutions.length,
      episodeCount: episodeResolutions.length,
      edgeCount: edgeResolutions.length,
      derivedCount: derivedInput.length,
      reflectionCount: reflectionInput.length,
      profileCounts: {
        entities: profileUpdates.entities.length,
        objects: profileUpdates.objects.length,
        locations: profileUpdates.locations.length
      },
      warnings
    }
  }
}

module.exports = {
  buildPersistencePacket
}
