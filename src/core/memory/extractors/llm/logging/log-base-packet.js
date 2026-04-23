'use strict'

const { trimText } = require('../utils/text')
const { LLM_LOGGING_CONFIG } = require('../config/logging.config')
const { LOG_STAGES } = require('../registries/log-stage.registry')
const { writeStageLog } = require('./write-stage-log')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

async function logBasePacket({
  traceId = null,
  eventId = null,
  threadId = null,
  platform = null,
  channel = null,
  speakerRole = null,
  speakerName = null,
  timestampIso = null,
  localizedTime = null,
  promptLanguage = null,
  messageText = '',
  recentContextCount = 0,
  fastSignals = [],
  extractorPlan = [],
  warnings = [],
  errors = [],
  note = null
} = {}) {
  return writeStageLog({
    stage: LOG_STAGES.BASE_PACKET,
    entry: {
      traceId,
      eventId,
      threadId,
      status: 'captured',
      extractorName: null,
      sourcePass: null,
      durationMs: null,
      warnings,
      errors,
      counts: {
        recentContextCount,
        fastSignalsCount: safeArray(fastSignals).length,
        extractorPlanCount: safeArray(extractorPlan).length
      },
      note:
        note == null
          ? null
          : trimText(note, LLM_LOGGING_CONFIG.previewLimits.noteChars),
      platform,
      channel,
      speakerRole,
      speakerName,
      timestamp_iso: timestampIso,
      localizedTime,
      promptLanguage,
      messageText: trimText(
        messageText,
        LLM_LOGGING_CONFIG.previewLimits.messageChars
      ),
      recentContextCount,
      fastSignals: safeArray(fastSignals),
      extractorPlan: safeArray(extractorPlan)
    }
  })
}

module.exports = {
  logBasePacket
}
