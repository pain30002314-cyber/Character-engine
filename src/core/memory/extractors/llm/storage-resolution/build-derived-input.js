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
    case 'micro_episode_candidate':
    case 'situational_context_signal':
    case 'local_interaction_signal':
    case 'participant_signal':
    case 'scene_location_signal':
    case 'scene_progression_signal':
      return 'episode_shift_summary'
    case 'relationship_candidate':
    case 'collaboration_signal':
    case 'vulnerability_signal':
    case 'openness_signal':
    case 'boundary_signal':
    case 'addressing_signal':
      return 'relationship_brief'
    case 'emotional_state_candidate':
    case 'emotional_shift_candidate':
      return 'episode_emotional_trace'
    case 'atmosphere_candidate':
    case 'tone_signal':
      return 'episode_atmosphere'
    case 'significance_candidate':
    case 'emphasis_signal':
    case 'scene_progression_signal':
    case 'phase_transition_candidate':
    case 'phase_marker_signal':
    case 'plan_marker_signal':
    case 'milestone_signal':
    case 'open_loop_candidate':
    case 'deferred_topic_signal':
    case 'pending_step_signal':
    case 'dependency_signal':
    case 'realization_candidate':
    case 'cognitive_update_candidate':
    case 'reframing_signal':
    case 'interpretation_shift_signal':
    case 'certainty_shift_signal':
      return 'episode_shift_summary'
    case 'location_candidate':
      return 'location_feel'
    case 'entity_candidate':
    case 'alias_signal':
    case 'role_signal':
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
