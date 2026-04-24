'use strict'

const {
  runLlmExtractionRuntime,
  runLlmExtractor,
  extractLlmAtomsV1,
  extractLlmClaims
} = require('./runtime')
const { orchestrateWideLlmExtraction } = require('./orchestrator')
const { buildBaseEventPacket } = require('./shared/build-base-event-packet')
const { buildPrompt, getPromptRoleByExtractorKey } = require('./shared/build-prompt')
const { normalizePassResult } = require('./normalization/normalize-pass-result')
const {
  LIFECYCLE_STATUSES
} = require('./registries/lifecycle-status.registry')
const {
  ROUTING_TARGETS
} = require('./lifecycle/lifecycle-routing-targets')
const { stageCandidatePool } = require('./lifecycle/stage-candidate-pool')
const { triageCandidatePool } = require('./lifecycle/triage-candidate-pool')
const { routeCandidatePool } = require('./lifecycle/route-candidate-pool')
const {
  buildPersistencePacket
} = require('./storage-resolution/build-persistence-packet')
const {
  resolveNodeCandidates
} = require('./storage-resolution/resolve-node-candidates')
const {
  resolveFactCandidates
} = require('./storage-resolution/resolve-fact-candidates')
const {
  resolveEpisodeCandidates
} = require('./storage-resolution/resolve-episode-candidates')
const {
  resolveEdgeCandidates
} = require('./storage-resolution/resolve-edge-candidates')
const {
  buildNodeEventLinks
} = require('./storage-resolution/build-node-event-links')
const {
  buildEpisodeEventLinks
} = require('./storage-resolution/build-episode-event-links')
const {
  buildProfileUpdates
} = require('./storage-resolution/build-profile-updates')
const {
  buildDerivedInput
} = require('./storage-resolution/build-derived-input')
const { logBasePacket } = require('./logging/log-base-packet')
const { logPassRun } = require('./logging/log-pass-run')
const { logNormalization } = require('./logging/log-normalization')
const { logMerge } = require('./logging/log-merge')
const { logTriage } = require('./logging/log-triage')
const { logRouting } = require('./logging/log-routing')
const { logPersistence } = require('./logging/log-persistence')
const { writeStageLog } = require('./logging/write-stage-log')
const { writeFailureLog } = require('./logging/write-failure-log')

module.exports = {
  runLlmExtractionRuntime,
  runLlmExtractor,
  extractLlmAtomsV1,
  extractLlmClaims,
  orchestrateWideLlmExtraction,
  buildBaseEventPacket,
  buildPrompt,
  getPromptRoleByExtractorKey,
  normalizePassResult,
  LIFECYCLE_STATUSES,
  ROUTING_TARGETS,
  stageCandidatePool,
  triageCandidatePool,
  routeCandidatePool,
  buildPersistencePacket,
  resolveNodeCandidates,
  resolveFactCandidates,
  resolveEpisodeCandidates,
  resolveEdgeCandidates,
  buildNodeEventLinks,
  buildEpisodeEventLinks,
  buildProfileUpdates,
  buildDerivedInput,
  logBasePacket,
  logPassRun,
  logNormalization,
  logMerge,
  logTriage,
  logRouting,
  logPersistence,
  writeStageLog,
  writeFailureLog
}
