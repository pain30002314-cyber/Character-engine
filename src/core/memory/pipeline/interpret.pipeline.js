const { getThreadMemory } = require('../store/memory.store')
const { updateIdentityProfileFromEvent, getCoreRefs } = require('../identity/identity.service')
const { getDefaultPriorityForSchema } = require('../governance/governance.rules')
const { filterAdmissibleClaims } = require('../hygiene/admission.service')
const { normalizeClaims } = require('../hygiene/claim-normalizer.service')
const {
  createBeliefItem,
  createEntityItem,
  createRelationshipSignalItem,
  createOpenLoopItem,
  createEpisodeStubItem
} = require('../canonical/canonical.schemas')
const { RAW_CLAIM_TYPE } = require('../../../shared/memory.types')

function extractClaimReferences(claim) {
  return claim?.payload?.references && typeof claim.payload.references === 'object'
    ? claim.payload.references
    : null
}

function sanitizeClaimRefValue(value) {
  const normalized = String(value || '').trim()
  return /^(core_user|core_character|entity|third_party):/i.test(normalized)
    ? normalized
    : null
}

function resolveClaimRef(refPayload, fallbackRef, options = {}) {
  if (!refPayload || typeof refPayload !== 'object') {
    return fallbackRef
  }

  const explicit = sanitizeClaimRefValue(refPayload.ref)
  if (explicit) return explicit

  if (options.allowNullUnknown && refPayload.role === 'unknown') {
    return null
  }

  return fallbackRef
}

function resolveClaimRefs(claim, refs) {
  const claimRefs = extractClaimReferences(claim)

  return {
    subjectRef: resolveClaimRef(claimRefs?.subject, refs.coreUserRef),
    objectRef: resolveClaimRef(claimRefs?.object, refs.coreCharacterRef, {
      allowNullUnknown: true
    })
  }
}

function mapRawFactClaim(claim, refs) {
  const resolvedRefs = resolveClaimRefs(claim, refs)

  return createBeliefItem({
    keyParts: [
      'belief',
      claim.payload?.category || 'general',
      claim.payload?.semanticKey || claim.text
    ],
    subjectRef: resolvedRefs.subjectRef,
    objectRef: resolvedRefs.objectRef,
    value: true,
    payload: {
      text: claim.text,
      category: claim.payload?.category || 'general',
      semanticKey: claim.payload?.semanticKey || null,
      kind: claim.payload?.semanticClass || 'structural',
    },
    sourceEventId: claim.sourceEventId,
    timestamp: claim.timestamp,
    confidence: claim.confidence || 0.7,
    importance: claim.payload?.importance || 50,
    stability: 0.65,
    priority: getDefaultPriorityForSchema('belief')
  })
}

function mapRawEntityClaim(claim) {
  return createEntityItem({
    keyParts: ['entity', claim.payload?.entityType || 'named', claim.text],
    subjectRef: `entity:${String(claim.text || '').toLowerCase()}`,
    payload: {
      name: claim.text,
      type: claim.payload?.entityType || 'named'
    },
    sourceEventId: claim.sourceEventId,
    timestamp: claim.timestamp,
    confidence: claim.confidence || 0.65,
    importance: claim.payload?.mentionCount
      ? 40 + claim.payload.mentionCount * 5
      : 45,
    stability: 0.7,
    priority: getDefaultPriorityForSchema('entity')
  })
}

function mapRawRelationshipClaim(claim, refs) {
  const resolvedRefs = resolveClaimRefs(claim, refs)

  return createRelationshipSignalItem({
    keyParts: ['relationship', claim.payload?.sentiment || 'signal', claim.text],
    subjectRef: resolvedRefs.subjectRef,
    objectRef: resolvedRefs.objectRef,
    payload: {
      text: claim.text,
      sentiment: claim.payload?.sentiment || 'signal'
    },
    sourceEventId: claim.sourceEventId,
    timestamp: claim.timestamp,
    confidence: claim.confidence || 0.7,
    importance: claim.payload?.importance || 60,
    stability: 0.45,
    priority: getDefaultPriorityForSchema('relationship_signal')
  })
}

function mapRawOpenLoopClaim(claim, refs) {
  const resolvedRefs = resolveClaimRefs(claim, refs)

  return createOpenLoopItem({
    keyParts: [
      'open_loop',
      claim.payload?.loopType || 'topic',
      claim.payload?.semanticKey || claim.text
    ],
    subjectRef: resolvedRefs.subjectRef,
    objectRef: resolvedRefs.objectRef,
    payload: {
      text: claim.text,
      type: claim.payload?.loopType || 'topic',
      status: claim.payload?.status || 'open',
      semanticKey: claim.payload?.semanticKey || null,
      normalizedText: claim.payload?.normalizedText || claim.text
    },
    sourceEventId: claim.sourceEventId,
    timestamp: claim.timestamp,
    confidence: claim.confidence || 0.65,
    importance: 55,
    stability: 0.35,
    priority: getDefaultPriorityForSchema('open_loop')
  })
}

function mapRawEpisodeClaim(claim, refs) {
  const resolvedRefs = resolveClaimRefs(claim, refs)

  return createEpisodeStubItem({
        keyParts: ['episode', claim.payload?.semanticKey || claim.text],
    subjectRef: resolvedRefs.subjectRef,
    payload: {
      summary: claim.text,
      semanticKey: claim.payload?.semanticKey || null
    },
    sourceEventId: claim.sourceEventId,
    timestamp: claim.timestamp,
    confidence: claim.confidence || 0.7,
    importance: claim.payload?.importance || 60,
    stability: 0.75,
    priority: getDefaultPriorityForSchema('episode_stub')
  })
}

function mapRawClaimToCanonical(claim, refs) {
  switch (claim.claimType) {
    case RAW_CLAIM_TYPE.FACT:
      return mapRawFactClaim(claim, refs)

    case RAW_CLAIM_TYPE.ENTITY:
      return mapRawEntityClaim(claim)

    case RAW_CLAIM_TYPE.RELATIONSHIP:
      return mapRawRelationshipClaim(claim, refs)

    case RAW_CLAIM_TYPE.OPEN_LOOP:
      return mapRawOpenLoopClaim(claim, refs)

    case RAW_CLAIM_TYPE.EPISODE:
      return mapRawEpisodeClaim(claim, refs)

    default:
      return null
  }
}

async function runInterpretPipeline({ threadId, event, extracted }) {
  const existingMemory = getThreadMemory(threadId)
  const nextIdentity = updateIdentityProfileFromEvent(existingMemory.identity, event)
  const refs = getCoreRefs(nextIdentity)

  const rawPacket = extracted?.rawPacket || {
    version: 1,
    strategy: 'unknown',
    claims: [],
    temporal: existingMemory.temporal
  }

  const normalizedClaims = normalizeClaims(rawPacket.claims || [])
  const admissibleClaims = filterAdmissibleClaims(normalizedClaims)

  const canonicalItems = admissibleClaims
    .map((claim) => mapRawClaimToCanonical(claim, refs))
    .filter(Boolean)

  return {
    identity: nextIdentity,
    rawExtraction: {
      ...rawPacket,
      claims: admissibleClaims
    },
    canonical: {
      items: canonicalItems
    },
    temporal: rawPacket.temporal || existingMemory.temporal
  }
}

module.exports = {
  runInterpretPipeline,
  resolveClaimRefs
}
