'use strict'

const LOG_STAGES = Object.freeze({
  BASE_PACKET: 'base-packet',
  EXTRACTOR_ENTITY_OBJECT_LOCATION: 'extractor-entity_object_location',
  EXTRACTOR_FACT: 'extractor-fact',
  EXTRACTOR_EPISODE: 'extractor-episode',
  EXTRACTOR_PHASE_OPEN_LOOP: 'extractor-phase_open_loop',
  EXTRACTOR_COGNITION_REALIZATION: 'extractor-cognition_realization',
  EXTRACTOR_EMOTION_ATMOSPHERE_SIGNIFICANCE:
    'extractor-emotion_atmosphere_significance',
  EXTRACTOR_RELATIONSHIP_SOCIAL: 'extractor-relationship_social',
  NORMALIZATION: 'normalization',
  MERGE: 'merge',
  TRIAGE: 'triage',
  ROUTING: 'routing',
  PERSISTENCE: 'persistence',
  DERIVED: 'derived',
  FAILURES: 'failures'
})

const EXTRACTOR_STAGE_BY_KEY = Object.freeze({
  'entity-object-location': LOG_STAGES.EXTRACTOR_ENTITY_OBJECT_LOCATION,
  fact: LOG_STAGES.EXTRACTOR_FACT,
  episode: LOG_STAGES.EXTRACTOR_EPISODE,
  'phase-open-loop': LOG_STAGES.EXTRACTOR_PHASE_OPEN_LOOP,
  'cognition-realization': LOG_STAGES.EXTRACTOR_COGNITION_REALIZATION,
  'emotion-atmosphere-significance':
    LOG_STAGES.EXTRACTOR_EMOTION_ATMOSPHERE_SIGNIFICANCE,
  'relationship-social': LOG_STAGES.EXTRACTOR_RELATIONSHIP_SOCIAL
})

function getExtractorLogStage(extractorKey) {
  return EXTRACTOR_STAGE_BY_KEY[String(extractorKey || '').trim()] || null
}

function isKnownLogStage(stage) {
  return Object.values(LOG_STAGES).includes(String(stage || '').trim())
}

module.exports = {
  LOG_STAGES,
  EXTRACTOR_STAGE_BY_KEY,
  getExtractorLogStage,
  isKnownLogStage
}
