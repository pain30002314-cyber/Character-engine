'use strict'

const memoryConfig = require('../../memory.config')
const { getThreadEvents } = require('../../store/events.store')
const { getThreadMemory } = require('../../store/memory.store')
const { extractLlmAtomsV1 } = require('../../extractors/llm')
const { createRawClaim, buildRawExtractionPacket } = require('../raw-extraction.builder')

function buildEventWindow(events, maxEvents, maxCharsPerEvent) {
  return (events || [])
    .slice(-maxEvents)
    .map((item) => ({
      id: item.id,
      role: item.role,
      timestamp: item.timestamp,
      text: String(item.text || '').slice(0, maxCharsPerEvent)
    }))
}

function atomToRawClaim(atom, event) {
  if (!atom || !atom.type || !atom.text) return null

  const confidence =
    typeof atom.confidence === 'number'
      ? Math.max(0, Math.min(1, atom.confidence))
      : 0.5

  switch (atom.type) {
    case 'fact':
      return createRawClaim({
        claimType: 'fact',
        text: atom.text,
        payload: {
          ...(atom.payload || {}),
          source: 'llm'
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    case 'entity':
      return createRawClaim({
        claimType: 'entity',
        text: atom.text,
        payload: {
          ...(atom.payload || {}),
          source: 'llm'
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    case 'relationship':
      return createRawClaim({
        claimType: 'relationship',
        text: atom.text,
        payload: {
          ...(atom.payload || {}),
          source: 'llm'
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    case 'open_loop':
      return createRawClaim({
        claimType: 'open_loop',
        text: atom.text,
        payload: {
          ...(atom.payload || {}),
          source: 'llm'
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    case 'episode':
      return createRawClaim({
        claimType: 'episode',
        text: atom.text,
        payload: {
          ...(atom.payload || {}),
          source: 'llm'
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    default:
      return null
  }
}

async function runLlmRawExtraction({ threadId, event }) {
  if (!event) {
    return {
      version: 2,
      strategy: 'llm_raw_v2',
      eventId: null,
      threadId,
      createdAt: new Date().toISOString(),
      claims: [],
      temporal: null,
      meta: {
        mode: 'llm_only'
      }
    }
  }

  const events = getThreadEvents(threadId, { includeInvalidForMemory: true })
  const eventWindow = buildEventWindow(
    events,
    memoryConfig.limits.rawContextEvents,
    memoryConfig.limits.rawContextCharsPerEvent
  )

  const llmResult = await extractLlmAtomsV1({
    event,
    eventWindow
  })

  const claims = (llmResult?.atoms || [])
    .map((atom) => atomToRawClaim(atom, event))
    .filter(Boolean)

  const currentMemory = getThreadMemory(threadId)

  return buildRawExtractionPacket({
    event,
    extracted: {
      facts: claims
        .filter((item) => item.claimType === 'fact')
        .map((item) => ({
          text: item.text,
          confidence: item.confidence,
          category: item.payload?.category || 'general',
          importance: item.payload?.importance || 50
        })),
      entities: claims
        .filter((item) => item.claimType === 'entity')
        .map((item) => ({
          name: item.text,
          type: item.payload?.entityType || 'named',
          confidence: item.confidence,
          mentionCount: item.payload?.mentionCount || 1
        })),
      relationshipSignals: claims
        .filter((item) => item.claimType === 'relationship')
        .map((item) => ({
          text: item.text,
          sentiment: item.payload?.sentiment || 'signal',
          confidence: item.confidence,
          importance: item.payload?.importance || 55
        })),
      openLoops: claims
        .filter((item) => item.claimType === 'open_loop')
        .map((item) => ({
          text: item.text,
          type: item.payload?.loopType || 'topic',
          status: item.payload?.status || 'open',
          confidence: item.confidence
        })),
      episodicMemories: claims
        .filter((item) => item.claimType === 'episode')
        .map((item) => ({
          summary: item.text,
          type: item.payload?.episodeType || 'event',
          confidence: item.confidence,
          importance: item.payload?.importance || 60
        })),
      temporal: currentMemory?.temporal || null
    },
    strategy: 'llm_raw_v2',
    meta: {
      mode: 'llm_only',
      llmAtoms: Array.isArray(llmResult?.atoms) ? llmResult.atoms.length : 0,
      llmWarnings: Array.isArray(llmResult?.service?.warnings)
        ? llmResult.service.warnings
        : [],
      regexExcludedFromLlmStrategy: true
    }
  })
}

module.exports = {
  runLlmRawExtraction
}