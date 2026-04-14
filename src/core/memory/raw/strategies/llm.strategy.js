'use strict'

const memoryConfig = require('../../memory.config')
const { getThreadEvents } = require('../../store/events.store')
const { getThreadMemory } = require('../../store/memory.store')
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

function pickEntityName(candidate) {
  const refs = candidate?.references || {}
  const pool = [refs.subject, refs.object, ...(Array.isArray(refs.about) ? refs.about : [])]
  const entityRef = pool.find((item) => item?.role === 'entity' && item?.label)

  return entityRef?.label || candidate?.text || ''
}

function buildCandidatePayload(candidate) {
  return {
    source: 'llm',
    semanticClass: candidate?.semantic?.class || null,
    semanticSubclass: candidate?.semantic?.subclass || null,
    semanticKey: candidate?.semantic?.key || null,
    semanticCategory: candidate?.semantic?.category || null,
    semanticTags: Array.isArray(candidate?.semantic?.tags)
      ? candidate.semantic.tags
      : [],
    references:
      candidate?.references && typeof candidate.references === 'object'
        ? candidate.references
        : null,
    memory:
      candidate?.memory && typeof candidate.memory === 'object'
        ? candidate.memory
        : null,
    evidence:
      candidate?.evidence && typeof candidate.evidence === 'object'
        ? candidate.evidence
        : null,
    temporal:
      candidate?.temporal && typeof candidate.temporal === 'object'
        ? candidate.temporal
        : null,
    sourceMeta:
      candidate?.source && typeof candidate.source === 'object'
        ? candidate.source
        : null
  }
}

function candidateToRawClaim(candidate, event) {
  if (!candidate || !candidate.kind || !candidate.text) return null

  const confidence =
    typeof candidate.confidence === 'number'
      ? Math.max(0, Math.min(1, candidate.confidence))
      : 0.5

  const payload = buildCandidatePayload(candidate)

  switch (candidate.kind) {
    case 'fact':
      return createRawClaim({
        claimType: 'fact',
        text: candidate.text,
        payload: {
          ...payload,
          category: candidate?.semantic?.category || candidate?.semantic?.class || 'general',
          importance: Math.round(
            40 + Math.max(candidate?.memory?.salience || 0, candidate?.memory?.memoryRelevance || 0) * 40
          )
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    case 'entity':
      return createRawClaim({
        claimType: 'entity',
        text: pickEntityName(candidate),
        payload: {
          ...payload,
          entityType: candidate?.semantic?.category || candidate?.semantic?.class || 'named',
          mentionCount: 1
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    case 'relationship':
      return createRawClaim({
        claimType: 'relationship',
        text: candidate.text,
        payload: {
          ...payload,
          sentiment: candidate?.semantic?.category || candidate?.semantic?.class || 'signal',
          importance: Math.round(
            45 + Math.max(candidate?.memory?.salience || 0, candidate?.memory?.memoryRelevance || 0) * 35
          )
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    case 'open_loop':
      return createRawClaim({
        claimType: 'open_loop',
        text: candidate.text,
        payload: {
          ...payload,
          loopType: candidate?.semantic?.category || candidate?.semantic?.class || 'topic',
          status:
            candidate?.temporal?.tense === 'future' || candidate?.temporal?.tense === 'ongoing'
              ? 'open'
              : 'open'
        },
        confidence,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })

    case 'episode':
      return createRawClaim({
        claimType: 'episode',
        text: candidate.text,
        payload: {
          ...payload,
          episodeType: candidate?.semantic?.category || candidate?.semantic?.class || 'event',
          importance: Math.round(
            45 + Math.max(candidate?.memory?.salience || 0, candidate?.memory?.memoryRelevance || 0) * 35
          )
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
  const { extractLlmAtomsV1 } = require('../../extractors/llm')

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

  const claims = (llmResult?.candidates || [])
    .map((candidate) => candidateToRawClaim(candidate, event))
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
      llmCandidates: Array.isArray(llmResult?.candidates) ? llmResult.candidates.length : 0,
      llmWarnings: Array.isArray(llmResult?.service?.warnings)
        ? llmResult.service.warnings
        : [],
      regexExcludedFromLlmStrategy: true
    }
  })
}

module.exports = {
  runLlmRawExtraction,
  candidateToRawClaim
}
