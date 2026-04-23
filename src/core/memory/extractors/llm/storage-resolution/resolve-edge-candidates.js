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

function resolveEdgeType(candidate) {
  switch (candidate?.kind) {
    case 'relationship_signal':
      return 'relationship'
    case 'collaboration_signal':
      return 'collaboration'
    case 'vulnerability_signal':
      return 'vulnerability'
    case 'openness_signal':
      return 'openness'
    case 'boundary_signal':
      return 'boundary'
    case 'addressing_signal':
      return 'addressing'
    case 'support_signal':
      return 'support'
    case 'contradiction_signal':
      return 'contradiction'
    case 'interaction_candidate':
      return 'participation'
    default:
      return 'association'
  }
}

function resolveEdgeCandidates(candidatePool = {}) {
  return getCandidatesByTarget(candidatePool, ROUTING_TARGETS.EDGE_RESOLUTION).map(
    (candidate) => {
      const payload = candidate?.payload || {}
      const summarySeeds = buildSummarySeeds(candidate)

      return {
        edgeResolutionId: buildResolutionId('edge_resolution', candidate, resolveEdgeType(candidate)),
        candidateId: candidate?.candidateId || candidate?.id || null,
        candidateKind: candidate?.kind || null,
        edgeType: resolveEdgeType(candidate),
        relationLabelSeed: pickFirstText(
          payload.relation,
          payload.label,
          summarySeeds.summaryShort,
          candidate?.kind
        ),
        fromNodeHints: pickStringList(
          payload.from,
          payload.source,
          payload.subject,
          payload.actor,
          payload.person
        ),
        toNodeHints: pickStringList(
          payload.to,
          payload.target,
          payload.object,
          payload.partner,
          payload.entity
        ),
        supportNodeHints: pickStringList(candidate?.relatedCandidateIds),
        polaritySeed:
          candidate?.kind === 'contradiction_signal'
            ? 'negative'
            : candidate?.kind === 'support_signal'
              ? 'positive'
              : 'neutral',
        summarySeed: summarySeeds.summaryShort,
        detailSeed: summarySeeds.summaryLong,
        tagSeeds: sanitizeTagList(candidate?.tags, 10),
        importanceSeed: coerceImportanceSeed(candidate?.importance),
        confidenceSeed: buildConfidenceSeed(candidate),
        provenance: buildPacketProvenance(candidate, candidatePool)
      }
    }
  )
}

module.exports = {
  resolveEdgeCandidates
}
