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
  sanitizeTagList
} = require('./helpers')

function resolveNodeType(candidate) {
  switch (candidate?.kind) {
    case 'entity_candidate':
    case 'alias_candidate':
    case 'role_candidate':
      return 'entity'
    case 'object_candidate':
      return 'object'
    case 'location_candidate':
      return 'location'
    default:
      return candidate?.sourcePass === 'entity-object-location' ? 'entity' : null
  }
}

function buildDisplayNameSeed(candidate) {
  const payload = candidate?.payload || {}

  return pickFirstText(
    payload.name,
    payload.label,
    payload.entity,
    payload.object,
    payload.location,
    payload.alias,
    candidate?.summary,
    candidate?.text
  )
}

function resolveNodeCandidates(candidatePool = {}) {
  return getCandidatesByTarget(candidatePool, ROUTING_TARGETS.NODE_RESOLUTION).map(
    (candidate) => {
      const payload = candidate?.payload || {}
      const nodeType = resolveNodeType(candidate)
      const displayNameSeed = buildDisplayNameSeed(candidate)
      const summarySeeds = buildSummarySeeds(candidate)
      const aliasSeeds = pickStringList(
        payload.alias,
        payload.aliases,
        candidate?.kind === 'alias_candidate' ? displayNameSeed : null
      )
      const roleSeeds = pickStringList(
        payload.role,
        payload.roles,
        candidate?.kind === 'role_candidate' ? displayNameSeed : null
      )

      return {
        nodeResolutionId: buildResolutionId('node_resolution', candidate, nodeType || 'node'),
        nodeType,
        candidateId: candidate?.candidateId || candidate?.id || null,
        candidateKind: candidate?.kind || null,
        sourcePass: candidate?.sourcePass || null,
        displayNameSeed,
        canonicalNameSeed: displayNameSeed,
        summarySeed: summarySeeds.summaryShort,
        summaryLongSeed: summarySeeds.summaryLong,
        aliasSeeds,
        roleSeeds,
        tagSeeds: sanitizeTagList(candidate?.tags, 12),
        importanceSeed: coerceImportanceSeed(candidate?.importance),
        confidenceSeed: buildConfidenceSeed(candidate),
        nodeSignals: {
          sourceText: candidate?.text || null,
          payload,
          sourcePass: candidate?.sourcePass || null
        },
        provenance: buildPacketProvenance(candidate, candidatePool)
      }
    }
  )
}

module.exports = {
  resolveNodeCandidates
}
