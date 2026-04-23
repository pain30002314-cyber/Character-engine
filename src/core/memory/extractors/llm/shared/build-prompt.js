'use strict'

const { PROMPT_CONFIG } = require('../config/prompt.config')
const { renderRoleBlock } = require('../prompts/blocks/role.block')
const { renderRulesBlock } = require('../prompts/blocks/rules.block')
const { renderEventMetaBlock } = require('../prompts/blocks/event-meta.block')
const { renderCurrentMessageBlock } = require('../prompts/blocks/current-message.block')
const { renderRecentContextBlock } = require('../prompts/blocks/recent-context.block')
const { renderFastSignalsBlock } = require('../prompts/blocks/fast-signals.block')
const { renderResponseFormatBlock } = require('../prompts/blocks/response-format.block')

const entityObjectLocationRole = require('../prompts/roles/entity-object-location.role')
const factRole = require('../prompts/roles/fact.role')
const episodeRole = require('../prompts/roles/episode.role')
const phaseOpenLoopRole = require('../prompts/roles/phase-open-loop.role')
const cognitionRealizationRole = require('../prompts/roles/cognition-realization.role')
const emotionAtmosphereSignificanceRole = require('../prompts/roles/emotion-atmosphere-significance.role')
const relationshipSocialRole = require('../prompts/roles/relationship-social.role')

const ROLE_BY_EXTRACTOR_KEY = Object.freeze({
  'entity-object-location': entityObjectLocationRole,
  fact: factRole,
  episode: episodeRole,
  'phase-open-loop': phaseOpenLoopRole,
  'cognition-realization': cognitionRealizationRole,
  'emotion-atmosphere-significance': emotionAtmosphereSignificanceRole,
  'relationship-social': relationshipSocialRole
})

function getPromptRoleByExtractorKey(extractorKey) {
  const normalizedKey = String(extractorKey || '').trim()
  const role = ROLE_BY_EXTRACTOR_KEY[normalizedKey]

  if (!role) {
    throw new Error(`unknown_prompt_role:${normalizedKey || 'empty'}`)
  }

  return role
}

function buildPrompt(baseEventPacket, extractorKey) {
  const role = getPromptRoleByExtractorKey(extractorKey)

  const sections = {
    role: renderRoleBlock(role),
    rules: renderRulesBlock(baseEventPacket),
    event_meta: renderEventMetaBlock(baseEventPacket),
    current_message: renderCurrentMessageBlock(baseEventPacket),
    recent_context: renderRecentContextBlock(baseEventPacket),
    fast_signals: renderFastSignalsBlock(baseEventPacket),
    response_format: renderResponseFormatBlock(baseEventPacket)
  }

  return PROMPT_CONFIG.sectionOrder
    .map((sectionKey) => sections[sectionKey])
    .filter(Boolean)
    .join(PROMPT_CONFIG.sectionDivider)
    .trim()
}

module.exports = {
  ROLE_BY_EXTRACTOR_KEY,
  getPromptRoleByExtractorKey,
  buildPrompt
}
