const { RAW_CLAIM_TYPE } = require('../../../shared/memory.types')

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function createRawClaim({
  claimType,
  text,
  payload = {},
  confidence = 0.5,
  sourceEventId,
  timestamp
}) {
  return {
    claimType,
    text: String(text || '').trim(),
    payload,
    confidence,
    sourceEventId,
    timestamp
  }
}

function buildRawExtractionPacket({
  event,
  extracted,
  strategy = 'heuristic_bridge_v1',
  meta = {}
}) {
  const claims = []

  for (const fact of safeArray(extracted?.facts)) {
    claims.push(
      createRawClaim({
        claimType: RAW_CLAIM_TYPE.FACT,
        text: fact.text,
        payload: {
          category: fact.category || 'general',
          importance: fact.importance || 50,
          source: 'heuristic'
        },
        confidence: fact.confidence || 0.7,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })
    )
  }

  for (const entity of safeArray(extracted?.entities)) {
    claims.push(
      createRawClaim({
        claimType: RAW_CLAIM_TYPE.ENTITY,
        text: entity.name,
        payload: {
          entityType: entity.type || 'named',
          mentionCount: entity.mentionCount || 1,
          source: 'heuristic'
        },
        confidence: entity.confidence || 0.65,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })
    )
  }

  for (const signal of safeArray(extracted?.relationshipSignals)) {
    claims.push(
      createRawClaim({
        claimType: RAW_CLAIM_TYPE.RELATIONSHIP,
        text: signal.text,
        payload: {
          sentiment: signal.sentiment || 'signal',
          importance: signal.importance || 55,
          source: 'heuristic'
        },
        confidence: signal.confidence || 0.7,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })
    )
  }

  for (const loop of safeArray(extracted?.openLoops)) {
    claims.push(
      createRawClaim({
        claimType: RAW_CLAIM_TYPE.OPEN_LOOP,
        text: loop.text,
        payload: {
          loopType: loop.type || 'topic',
          status: loop.status || 'open',
          source: 'heuristic'
        },
        confidence: loop.confidence || 0.65,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })
    )
  }

  for (const episode of safeArray(extracted?.episodicMemories)) {
    claims.push(
      createRawClaim({
        claimType: RAW_CLAIM_TYPE.EPISODE,
        text: episode.summary,
        payload: {
          importance: episode.importance || 60,
          source: 'heuristic'
        },
        confidence: 0.7,
        sourceEventId: event.id,
        timestamp: event.timestamp
      })
    )
  }

  return {
    version: 2,
    strategy,
    eventId: event.id,
    threadId: event.threadId,
    createdAt: new Date().toISOString(),
    claims,
    temporal: extracted?.temporal || null,
    meta
  }
}

module.exports = {
  createRawClaim,
  buildRawExtractionPacket
}