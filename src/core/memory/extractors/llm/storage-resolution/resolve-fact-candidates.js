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

function resolvePredicateSeed(candidate) {
  switch (candidate?.kind) {
    case 'fact_support_signal':
      return 'supports'
    case 'fact_contradiction_signal':
      return 'contradicts'
    case 'fact_refinement_signal':
      return 'refines'
    case 'temporal_fact_candidate':
      return 'describes_temporal_fact'
    default:
      return 'states'
  }
}

function resolveFactCandidates(candidatePool = {}) {
  return getCandidatesByTarget(candidatePool, ROUTING_TARGETS.FACT_RESOLUTION).map(
    (candidate) => {
      const payload = candidate?.payload || {}
      const summarySeeds = buildSummarySeeds(candidate)
      const subjectSeed = pickFirstText(
        payload.subject,
        payload.entity,
        payload.actor,
        payload.person,
        payload.owner
      )
      const objectTextSeed = pickFirstText(
        payload.objectText,
        payload.object,
        payload.value,
        payload.detail,
        summarySeeds.summaryShort,
        candidate?.text
      )

      return {
        factResolutionId: buildResolutionId('fact_resolution', candidate, candidate?.kind || 'fact'),
        candidateId: candidate?.candidateId || candidate?.id || null,
        candidateKind: candidate?.kind || null,
        factType: candidate?.kind || 'fact_candidate',
        subjectSeed,
        predicateSeed: pickFirstText(payload.predicate, resolvePredicateSeed(candidate)),
        objectTextSeed,
        objectNodeHint: pickFirstText(
          payload.objectNodeHint,
          payload.objectRef,
          payload.subjectRef
        ),
        summarySeed: summarySeeds.summaryShort,
        detailSeed: summarySeeds.summaryLong,
        qualifiers: {
          tags: sanitizeTagList(candidate?.tags, 12),
          qualifiers: payload?.qualifiers && typeof payload.qualifiers === 'object'
            ? payload.qualifiers
            : {},
          importanceSeed: coerceImportanceSeed(candidate?.importance),
          confidenceSeed: buildConfidenceSeed(candidate)
        },
        temporalHints: {
          timestampIso: candidate?.timestamp_iso || null,
          temporal: candidate?.temporal && typeof candidate.temporal === 'object'
            ? candidate.temporal
            : {},
          payload: {
            startsAt: payload?.startsAt || null,
            endsAt: payload?.endsAt || null,
            when: payload?.when || null
          }
        },
        supportContext: {
          supportType: candidate?.kind || null,
          relatedCandidateIds: pickStringList(candidate?.relatedCandidateIds),
          contradictionTo: pickFirstText(payload?.contradictionTo),
          refinementOf: pickFirstText(payload?.refinementOf)
        },
        provenance: buildPacketProvenance(candidate, candidatePool)
      }
    }
  )
}

module.exports = {
  resolveFactCandidates
}
