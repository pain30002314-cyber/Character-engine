'use strict'

const PROMPT_CONFIG = Object.freeze({
  version: 'llm_wide_prompt_v1',
  promptLanguage: 'русский',
  promptLanguageCode: 'ru',
  promptTimezone: 'Asia/Krasnoyarsk',
  promptUtcOffsetLabel: 'UTC+7',
  currentMessageChars: 2200,
  recentContextItems: 6,
  recentContextCharsPerItem: 240,
  fastSignalsLimit: 6,
  tagsLimit: 4,
  sectionDivider: '\n\n',
  sectionOrder: Object.freeze([
    'role',
    'rules',
    'event_meta',
    'current_message',
    'recent_context',
    'fast_signals',
    'response_format'
  ])
})

module.exports = {
  PROMPT_CONFIG
}
