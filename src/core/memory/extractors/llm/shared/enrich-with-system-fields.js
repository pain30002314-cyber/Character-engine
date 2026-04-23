'use strict'

const { createCandidateId, createTraceId } = require('../utils/ids')
const { getNowIso, resolveEventTimestampIso } = require('../utils/time')
const { normalizePromptLanguage } = require('../utils/language')

function enrichWithSystemFields({
  candidates = [],
  pass,
  event,
  promptPacket = {},
  flowConfig = {},
  llmCall = {},
  traceId = null
}) {
  const resolvedTraceId = traceId || createTraceId('llm_pass')
  const createdAt = getNowIso()
  const timestampIso = resolveEventTimestampIso(event, createdAt)
  const promptLanguage = normalizePromptLanguage(promptPacket?.promptLanguage, 'ru')

  return {
    traceId: resolvedTraceId,
    candidates: (Array.isArray(candidates) ? candidates : []).map((candidate, index) => {
      const candidateId = createCandidateId({
        traceId: resolvedTraceId,
        eventId: event?.id || null,
        sourcePass: pass?.extractorKey || 'unknown',
        index,
        text: candidate?.text || ''
      })

      return {
        ...candidate,
        id: candidateId,
        candidateId,
        traceId: resolvedTraceId,
        eventId: event?.id || null,
        threadId: event?.threadId || null,
        sourcePass: pass?.extractorKey || null,
        extractorName: pass?.extractorName || null,
        timestamp_iso: timestampIso,
        platform: event?.platform || null,
        channel: event?.channel || null,
        speakerRole: event?.role || null,
        speakerName: promptPacket?.baseEventPacket?.event?.speakerName || null,
        promptLanguage,
        model: llmCall?.model || null,
        extractorVersion: flowConfig?.extractorVersion || null,
        createdAt,
        sourceText: event?.text || '',
        source: {
          extractor: 'llm_wide',
          extractorKey: pass?.extractorKey || null,
          extractorName: pass?.extractorName || null,
          extractorVersion: flowConfig?.extractorVersion || null,
          promptVersion: promptPacket?.promptVersion || null,
          promptLanguage,
          model: llmCall?.model || null,
          promptTransport: flowConfig?.promptTransport || null,
          sourceEventId: event?.id || null,
          timestamp: timestampIso
        }
      }
    })
  }
}

module.exports = {
  enrichWithSystemFields
}
