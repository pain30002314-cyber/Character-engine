'use strict'

const { ROUTING_TARGETS } = require('../lifecycle/lifecycle-routing-targets')
const {
  getCandidatesByTarget,
  pickFirstText,
  pickStringList,
  buildResolutionId,
  buildPacketProvenance,
  buildSummarySeeds,
  buildCandidateBucketRef,
  sanitizeTagList
} = require('./helpers')

function resolveDerivedType(candidate) {
  switch (candidate?.kind) {
    case 'episode_candidate':
    case 'scene_candidate':
    case 'micro_scene_candidate':
    case 'interaction_candidate':
    case 'progression_signal':
      return 'episode_shift_summary'
    case 'relationship_signal':
    case 'collaboration_signal':
    case 'vulnerability_signal':
    case 'openness_signal':
    case 'boundary_signal':
    case 'addressing_signal':
      return 'relationship_brief'
    case 'emotional_state':
    case 'emotional_shift':
      return 'episode_emotional_trace'
    case 'atmosphere_signal':
    case 'tone_signal':
      return 'episode_atmosphere'
    case 'significance_signal':
    case 'emphasis_signal':
    case 'progression_signal':
    case 'phase_transition':
    case 'phase_marker':
    case 'plan_marker':
    case 'milestone_signal':
    case 'open_loop_candidate':
    case 'deferred_topic':
    case 'pending_step':
    case 'dependency_signal':
    case 'realization_signal':
    case 'cognitive_update':
    case 'reframing_signal':
    case 'interpretation_shift':
    case 'certainty_shift':
      return 'episode_shift_summary'
    case 'location_candidate':
      return 'location_feel'
    case 'entity_candidate':
    case 'alias_candidate':
    case 'role_candidate':
      return 'entity_impression'
    default:
      return 'brief_opinion'
  }
}

function buildDerivedInput(candidatePool = {}) {
  return getCandidatesByTarget(candidatePool, ROUTING_TARGETS.DERIVED_INPUT).map(
    (candidate) => {
      const summarySeeds = buildSummarySeeds(candidate)

      return {
        derivedInputId: buildResolutionId(
          'derived_input',
          candidate,
          resolveDerivedType(candidate)
        ),
        derivedType: resolveDerivedType(candidate),
        candidateId: candidate?.candidateId || candidate?.id || null,
        candidateKind: candidate?.kind || null,
        bucketRef: buildCandidateBucketRef(candidate, 'derived'),
        textSeed: summarySeeds.summaryLong,
        summarySeed: summarySeeds.summaryShort,
        moodSeeds: pickStringList(
          candidate?.payload?.mood,
          candidate?.payload?.atmosphere,
          candidate?.payload?.tone
        ),
        targetHints: pickStringList(
          candidate?.payload?.entity,
          candidate?.payload?.location,
          candidate?.payload?.participants,
          candidate?.payload?.people
        ),
        tags: sanitizeTagList(candidate?.tags, 10),
        provenance: buildPacketProvenance(candidate, candidatePool)
      }
    }
  )
}

module.exports = {
  buildDerivedInput
}
