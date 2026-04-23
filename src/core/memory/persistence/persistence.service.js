'use strict'

const { stableHash } = require('../extractors/llm/utils/ids')
const { logPersistence } = require('../extractors/llm/logging/log-persistence')
const { withTransaction } = require('./postgres/client')
const { createMemoryEventsRepository } = require('./postgres/memory-events.repository')
const { createMemoryNodesRepository } = require('./postgres/memory-nodes.repository')
const { createEntityProfilesRepository } = require('./postgres/entity-profiles.repository')
const { createObjectProfilesRepository } = require('./postgres/object-profiles.repository')
const { createLocationProfilesRepository } = require('./postgres/location-profiles.repository')
const { createFactRecordsRepository } = require('./postgres/fact-records.repository')
const { createEpisodeRecordsRepository } = require('./postgres/episode-records.repository')
const { createMemoryEdgesRepository } = require('./postgres/memory-edges.repository')
const { createNodeEventLinksRepository } = require('./postgres/node-event-links.repository')
const { createEpisodeEventLinksRepository } = require('./postgres/episode-event-links.repository')
const { createDerivedSnapshotsRepository } = require('./postgres/derived-snapshots.repository')
const { createReflectionUpdatesRepository } = require('./postgres/reflection-updates.repository')
const {
  jsonValue,
  isoNow,
  numericOrNull,
  importanceToScore
} = require('./postgres/repository.helpers')

const DEFAULT_COUNTS = Object.freeze({
  createdEvents: 0,
  createdNodes: 0,
  updatedNodes: 0,
  createdEntityProfiles: 0,
  createdObjectProfiles: 0,
  createdLocationProfiles: 0,
  createdFacts: 0,
  updatedFacts: 0,
  createdEpisodes: 0,
  updatedEpisodes: 0,
  createdEdges: 0,
  createdNodeEventLinks: 0,
  createdEpisodeEventLinks: 0,
  createdDerivedSnapshots: 0,
  createdReflectionUpdates: 0
})

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function cloneCounts() {
  return { ...DEFAULT_COUNTS }
}

function buildEmptyResult(traceId = null, eventId = null) {
  return {
    traceId,
    eventId,
    status: 'success',
    counts: cloneCounts(),
    warnings: [],
    errors: []
  }
}

function hasAnyWrites(counts = {}) {
  return Object.values(counts).some((value) => Number(value || 0) > 0)
}

function buildErrorMessage(stage, error, itemId = null) {
  const suffix = itemId ? `:${itemId}` : ''
  return `${stage}${suffix}:${error?.message || 'unknown_error'}`
}

function buildPersistenceId(prefix, value) {
  return `${prefix}:${stableHash(String(value || `${prefix}:${isoNow()}`))}`
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase()
}

function addIndexKey(index, key, nodeId) {
  const normalizedKey = normalizeName(key)

  if (!normalizedKey) {
    return
  }

  if (!index.has(normalizedKey)) {
    index.set(normalizedKey, nodeId)
  }
}

function buildNodeLookup(nodes = []) {
  const index = new Map()

  for (const node of safeArray(nodes)) {
    const nodeId = node?.id || null

    if (!nodeId) {
      continue
    }

    addIndexKey(index, node?.canonical_name, nodeId)
    addIndexKey(index, node?.display_name, nodeId)

    for (const alias of safeArray(node?.aliases)) {
      addIndexKey(index, alias, nodeId)
    }
  }

  return index
}

function resolveNodeId(hints, nodeLookup) {
  for (const hint of safeArray(hints)) {
    const resolved = nodeLookup.get(normalizeName(hint))

    if (resolved) {
      return resolved
    }
  }

  return null
}

function asHintList(...values) {
  const result = []

  for (const value of values) {
    if (Array.isArray(value)) {
      result.push(...value)
      continue
    }

    if (value != null && value !== '') {
      result.push(value)
    }
  }

  return result
}

function normalizeRawEvent(rawEvent = {}, fallback = {}) {
  const event = safeObject(rawEvent)
  const source = event?.source || fallback?.source || 'storage-resolution'
  const timestamp = event?.timestamp || fallback?.timestamp || isoNow()

  if (!event?.id && !fallback?.eventId) {
    return null
  }

  return {
    id: event?.id || fallback?.eventId || null,
    thread_id: event?.threadId || event?.thread_id || fallback?.threadId || null,
    source,
    role: event?.role || null,
    platform: event?.platform || null,
    channel: event?.channel || null,
    timestamp,
    text: event?.text || '',
    raw_payload_json: jsonValue(event),
    embedding: event?.embedding || null,
    created_at: event?.created_at || timestamp
  }
}

function mapNodeRecord(node = {}) {
  const now = isoNow()

  return {
    id: node?.id || node?.node_id || node?.nodeResolutionId || null,
    node_type: node?.node_type || node?.nodeType || null,
    status: node?.status || node?.lifecycleStatus || 'active',
    canonical_name: node?.canonical_name || node?.canonicalName || node?.canonicalNameSeed || null,
    display_name: node?.display_name || node?.displayName || node?.displayNameSeed || null,
    summary_short: node?.summary_short || node?.summaryShort || node?.summarySeed || null,
    summary_long: node?.summary_long || node?.summaryLong || node?.summaryLongSeed || null,
    aliases: safeArray(node?.aliases).length > 0
      ? safeArray(node.aliases)
      : safeArray(node?.aliasSeeds),
    embedding: node?.embedding || null,
    importance_score: numericOrNull(node?.importance_score ?? node?.importanceScore) ??
      importanceToScore(node?.importanceSeed),
    salience_score: numericOrNull(node?.salience_score ?? node?.salienceScore),
    confidence_score: numericOrNull(node?.confidence_score ?? node?.confidenceScore ?? node?.confidenceSeed),
    recall_count: Number.isFinite(Number(node?.recall_count ?? node?.recallCount))
      ? Number(node?.recall_count ?? node?.recallCount)
      : 0,
    last_recalled_at: node?.last_recalled_at || node?.lastRecalledAt || null,
    last_updated_at:
      node?.last_updated_at ||
      node?.lastUpdatedAt ||
      node?.provenance?.timestampIso ||
      now,
    created_at: node?.created_at || node?.createdAt || now
  }
}

function mapEntityProfile(profile = {}) {
  return {
    node_id: profile?.node_id || profile?.nodeId || profile?.nodeResolutionId || null,
    entity_kind: profile?.entity_kind || profile?.entityKind || 'entity',
    display_name: profile?.display_name || profile?.displayName || null,
    aliases_json: jsonValue(profile?.aliases_json ?? profile?.aliases ?? []),
    traits_json: jsonValue(profile?.traits_json ?? profile?.tagSeeds ?? []),
    appearance_summary: profile?.appearance_summary || profile?.appearanceSummary || null,
    voice_summary: profile?.voice_summary || profile?.voiceSummary || null,
    relationship_summary: profile?.relationship_summary || profile?.relationshipSummary || null,
    opinion_summary: profile?.opinion_summary || profile?.opinionSummary || null,
    emotion_imprint_summary:
      profile?.emotion_imprint_summary || profile?.emotionImprintSummary || profile?.meaningSummary || null
  }
}

function mapObjectProfile(profile = {}) {
  return {
    node_id: profile?.node_id || profile?.nodeId || profile?.nodeResolutionId || null,
    object_kind: profile?.object_kind || profile?.objectKind || 'object',
    display_name: profile?.display_name || profile?.displayName || null,
    aliases_json: jsonValue(profile?.aliases_json ?? profile?.aliases ?? []),
    appearance_summary: profile?.appearance_summary || profile?.appearanceSummary || null,
    meaning_summary: profile?.meaning_summary || profile?.meaningSummary || null,
    ownership_summary: profile?.ownership_summary || profile?.ownershipSummary || null,
    condition_summary: profile?.condition_summary || profile?.conditionSummary || null
  }
}

function mapLocationProfile(profile = {}) {
  return {
    node_id: profile?.node_id || profile?.nodeId || profile?.nodeResolutionId || null,
    location_kind: profile?.location_kind || profile?.locationKind || 'location',
    display_name: profile?.display_name || profile?.displayName || null,
    aliases_json: jsonValue(profile?.aliases_json ?? profile?.aliases ?? []),
    spatial_summary: profile?.spatial_summary || profile?.spatialSummary || null,
    atmosphere_summary: profile?.atmosphere_summary || profile?.atmosphereSummary || null,
    meaning_summary: profile?.meaning_summary || profile?.meaningSummary || null,
    stability_score: numericOrNull(profile?.stability_score ?? profile?.stabilityScore)
  }
}

function mapFactRecord(fact = {}, nodeLookup, warnings) {
  const nodeId = fact?.node_id || fact?.nodeId || fact?.factResolutionId || null
  const subjectNodeId =
    fact?.subject_node_id ||
    fact?.subjectNodeId ||
    resolveNodeId(asHintList(fact?.subjectSeed, fact?.subjectHints), nodeLookup)
  const objectNodeId =
    fact?.object_node_id ||
    fact?.objectNodeId ||
    resolveNodeId(asHintList(fact?.objectNodeHint, fact?.objectHints), nodeLookup)

  if (!subjectNodeId) {
    warnings.push(`fact_subject_unresolved:${nodeId || 'unknown'}`)
  }

  return {
    node_id: nodeId,
    subject_node_id: subjectNodeId,
    predicate: fact?.predicate || fact?.predicateSeed || 'states',
    object_node_id: objectNodeId,
    object_text: fact?.object_text || fact?.objectText || fact?.objectTextSeed || null,
    qualifier_json: jsonValue(
      fact?.qualifier_json ??
      {
        qualifiers: fact?.qualifiers || {},
        temporalHints: fact?.temporalHints || {},
        supportContext: fact?.supportContext || {}
      }
    ),
    valid_time_start:
      fact?.valid_time_start ||
      fact?.validTimeStart ||
      fact?.temporalHints?.payload?.startsAt ||
      fact?.temporalHints?.temporal?.start ||
      null,
    valid_time_end:
      fact?.valid_time_end ||
      fact?.validTimeEnd ||
      fact?.temporalHints?.payload?.endsAt ||
      fact?.temporalHints?.temporal?.end ||
      null,
    confidence_score: numericOrNull(fact?.confidence_score ?? fact?.confidenceScore ?? fact?.qualifiers?.confidenceSeed),
    source_count: Number.isFinite(Number(fact?.source_count ?? fact?.sourceCount))
      ? Number(fact?.source_count ?? fact?.sourceCount)
      : Math.max(1, safeArray(fact?.supportContext?.relatedCandidateIds).length),
    last_supported_at:
      fact?.last_supported_at ||
      fact?.lastSupportedAt ||
      fact?.provenance?.timestampIso ||
      null,
    last_contradicted_at: fact?.last_contradicted_at || fact?.lastContradictedAt || null
  }
}

function mapEpisodeRecord(episode = {}, nodeLookup, warnings) {
  const nodeId = episode?.node_id || episode?.nodeId || episode?.episodeResolutionId || null
  const locationNodeId =
    episode?.location_node_id ||
    episode?.locationNodeId ||
    resolveNodeId(asHintList(episode?.locationHints), nodeLookup)

  if (safeArray(episode?.locationHints).length > 0 && !locationNodeId) {
    warnings.push(`episode_location_unresolved:${nodeId || 'unknown'}`)
  }

  return {
    node_id: nodeId,
    title: episode?.title || episode?.titleSeed || episode?.summaryShortSeed || null,
    episode_type: episode?.episode_type || episode?.episodeType || 'episode',
    started_at:
      episode?.started_at ||
      episode?.startedAt ||
      safeArray(episode?.startedAtHints)[0] ||
      episode?.provenance?.timestampIso ||
      null,
    ended_at:
      episode?.ended_at ||
      episode?.endedAt ||
      safeArray(episode?.endedAtHints)[0] ||
      null,
    location_node_id: locationNodeId,
    summary_short: episode?.summary_short || episode?.summaryShort || episode?.summaryShortSeed || null,
    summary_long: episode?.summary_long || episode?.summaryLong || episode?.summaryLongSeed || null,
    atmosphere_summary:
      episode?.atmosphere_summary ||
      episode?.atmosphereSummary ||
      safeArray(episode?.atmosphereSeeds).join(', ') ||
      null,
    mood_summary: episode?.mood_summary || episode?.moodSummary || null,
    shift_summary: episode?.shift_summary || episode?.shiftSummary || null,
    emotional_weight: numericOrNull(episode?.emotional_weight ?? episode?.emotionalWeight ?? episode?.importanceSeed),
    novelty_score: numericOrNull(episode?.novelty_score ?? episode?.noveltyScore),
    resolved_state: episode?.resolved_state || episode?.resolvedState || 'open',
    source_event_count: Number.isFinite(Number(episode?.source_event_count ?? episode?.sourceEventCount ?? episode?.sourceEventCountSeed))
      ? Number(episode?.source_event_count ?? episode?.sourceEventCount ?? episode?.sourceEventCountSeed)
      : 1
  }
}

function mapEdgeRecord(edge = {}, nodeLookup, warnings, fallbackEventId = null) {
  const fromNodeId =
    edge?.from_node_id ||
    edge?.fromNodeId ||
    resolveNodeId(asHintList(edge?.fromNodeHints), nodeLookup)
  const toNodeId =
    edge?.to_node_id ||
    edge?.toNodeId ||
    resolveNodeId(asHintList(edge?.toNodeHints), nodeLookup)

  if (!fromNodeId || !toNodeId) {
    warnings.push(`edge_nodes_unresolved:${edge?.id || edge?.edgeResolutionId || 'unknown'}`)
  }

  return {
    id: edge?.id || edge?.edgeResolutionId || buildPersistenceId('memory_edge', JSON.stringify(edge)),
    from_node_id: fromNodeId,
    to_node_id: toNodeId,
    edge_type: edge?.edge_type || edge?.edgeType || 'related_to',
    weight: numericOrNull(edge?.weight) ?? 1,
    confidence_score: numericOrNull(edge?.confidence_score ?? edge?.confidenceScore ?? edge?.confidenceSeed),
    created_from_event_id:
      edge?.created_from_event_id ||
      edge?.createdFromEventId ||
      edge?.provenance?.eventId ||
      fallbackEventId,
    created_at: edge?.created_at || edge?.createdAt || isoNow(),
    last_updated_at:
      edge?.last_updated_at ||
      edge?.lastUpdatedAt ||
      edge?.provenance?.timestampIso ||
      isoNow()
  }
}

function mapNodeEventLink(link = {}, fallbackEventId = null) {
  return {
    node_id: link?.node_id || link?.nodeId || link?.nodeResolutionId || null,
    event_id: link?.event_id || link?.eventId || fallbackEventId || null,
    link_role: link?.link_role || link?.linkRole || 'mention',
    weight: numericOrNull(link?.weight) ?? 1
  }
}

function mapEpisodeEventLink(link = {}, fallbackEventId = null) {
  return {
    episode_node_id:
      link?.episode_node_id ||
      link?.episodeNodeId ||
      link?.episodeResolutionId ||
      null,
    event_id: link?.event_id || link?.eventId || fallbackEventId || null,
    position_index: Number.isFinite(Number(link?.position_index ?? link?.positionIndex))
      ? Number(link?.position_index ?? link?.positionIndex)
      : 0
  }
}

function mapDerivedSnapshot(snapshot = {}, nodeLookup, fallbackEventId = null, warnings = []) {
  const nodeId =
    snapshot?.node_id ||
    snapshot?.nodeId ||
    resolveNodeId(asHintList(snapshot?.targetHints), nodeLookup)

  if (safeArray(snapshot?.targetHints).length > 0 && !nodeId) {
    warnings.push(`derived_snapshot_target_unresolved:${snapshot?.id || snapshot?.derivedInputId || 'unknown'}`)
  }

  return {
    id: snapshot?.id || snapshot?.derivedInputId || buildPersistenceId('derived_snapshot', JSON.stringify(snapshot)),
    node_id: nodeId,
    snapshot_type: snapshot?.snapshot_type || snapshot?.snapshotType || snapshot?.derivedType || 'brief_opinion',
    text_value: snapshot?.text_value || snapshot?.textValue || snapshot?.summarySeed || snapshot?.textSeed || null,
    json_value: jsonValue(
      snapshot?.json_value ??
      snapshot?.jsonValue ??
      {
        moodSeeds: snapshot?.moodSeeds || [],
        tags: snapshot?.tags || [],
        provenance: snapshot?.provenance || null
      }
    ),
    version: Number.isFinite(Number(snapshot?.version)) ? Number(snapshot.version) : 1,
    confidence_score: numericOrNull(snapshot?.confidence_score ?? snapshot?.confidenceScore),
    based_on_node_ids_json: jsonValue(
      snapshot?.based_on_node_ids_json ??
      snapshot?.basedOnNodeIds ??
      safeArray(nodeId ? [nodeId] : [])
    ),
    based_on_event_ids_json: jsonValue(
      snapshot?.based_on_event_ids_json ??
      snapshot?.basedOnEventIds ??
      safeArray(snapshot?.provenance?.eventId || fallbackEventId ? [snapshot?.provenance?.eventId || fallbackEventId] : [])
    ),
    generated_by: snapshot?.generated_by || snapshot?.generatedBy || 'storage-resolution',
    created_at: snapshot?.created_at || snapshot?.createdAt || isoNow(),
    superseded_at: snapshot?.superseded_at || snapshot?.supersededAt || null
  }
}

function mapReflectionUpdate(update = {}) {
  return {
    id: update?.id || update?.reflectionUpdateId || update?.reflectionInputId || buildPersistenceId('reflection_update', JSON.stringify(update)),
    target_node_id: update?.target_node_id || update?.targetNodeId || null,
    target_field: update?.target_field || update?.targetField || 'summary',
    operation_type: update?.operation_type || update?.operationType || 'upsert',
    old_value_json: jsonValue(update?.old_value_json ?? update?.oldValue ?? null),
    new_value_json: jsonValue(
      update?.new_value_json ??
      update?.newValue ??
      {
        summarySeed: update?.summarySeed || null,
        textSeed: update?.textSeed || null,
        provenance: update?.provenance || null
      }
    ),
    reason_summary: update?.reason_summary || update?.reasonSummary || update?.summarySeed || null,
    source_reflection_pass_id:
      update?.source_reflection_pass_id ||
      update?.sourceReflectionPassId ||
      update?.candidateId ||
      null,
    created_at: update?.created_at || update?.createdAt || isoNow()
  }
}

function normalizeStoragePacket(storagePacket = {}, options = {}) {
  const packet = safeObject(storagePacket)
  const warnings = []
  const rawEvent = normalizeRawEvent(packet?.rawEvent || options?.rawEvent || null, {
    eventId: packet?.eventId || options?.eventId || null,
    threadId: packet?.threadId || options?.threadId || null,
    timestamp: options?.timestamp || null,
    source: options?.source || null
  })
  const nodes = safeArray(packet?.nodes).map(mapNodeRecord)

  if (nodes.length === 0) {
    for (const resolution of safeArray(packet?.nodeResolutions)) {
      nodes.push(mapNodeRecord(resolution))
    }
  }

  const nodeLookup = buildNodeLookup(nodes)
  const entityProfiles = safeArray(packet?.entityProfiles).map(mapEntityProfile)
  const objectProfiles = safeArray(packet?.objectProfiles).map(mapObjectProfile)
  const locationProfiles = safeArray(packet?.locationProfiles).map(mapLocationProfile)

  if (entityProfiles.length === 0 && packet?.profileUpdates?.entities) {
    entityProfiles.push(...safeArray(packet.profileUpdates.entities).map(mapEntityProfile))
  }

  if (objectProfiles.length === 0 && packet?.profileUpdates?.objects) {
    objectProfiles.push(...safeArray(packet.profileUpdates.objects).map(mapObjectProfile))
  }

  if (locationProfiles.length === 0 && packet?.profileUpdates?.locations) {
    locationProfiles.push(...safeArray(packet.profileUpdates.locations).map(mapLocationProfile))
  }

  const facts = safeArray(packet?.facts).map((fact) => mapFactRecord(fact, nodeLookup, warnings))

  if (facts.length === 0) {
    facts.push(...safeArray(packet?.factResolutions).map((fact) => mapFactRecord(fact, nodeLookup, warnings)))
  }

  const episodes = safeArray(packet?.episodes).map((episode) =>
    mapEpisodeRecord(episode, nodeLookup, warnings)
  )

  if (episodes.length === 0) {
    episodes.push(
      ...safeArray(packet?.episodeResolutions).map((episode) =>
        mapEpisodeRecord(episode, nodeLookup, warnings)
      )
    )
  }

  const edges = safeArray(packet?.edges).map((edge) =>
    mapEdgeRecord(edge, nodeLookup, warnings, rawEvent?.id || packet?.eventId || null)
  )

  if (edges.length === 0) {
    edges.push(
      ...safeArray(packet?.edgeResolutions).map((edge) =>
        mapEdgeRecord(edge, nodeLookup, warnings, rawEvent?.id || packet?.eventId || null)
      )
    )
  }

  const nodeEventLinks = safeArray(packet?.nodeEventLinks).map((link) =>
    mapNodeEventLink(link, rawEvent?.id || packet?.eventId || null)
  )

  if (nodeEventLinks.length === 0) {
    nodeEventLinks.push(
      ...safeArray(packet?.nodeEventLinks).map((link) =>
        mapNodeEventLink(link, rawEvent?.id || packet?.eventId || null)
      )
    )
  }

  const episodeEventLinks = safeArray(packet?.episodeEventLinks).map((link) =>
    mapEpisodeEventLink(link, rawEvent?.id || packet?.eventId || null)
  )

  const derivedSnapshots = safeArray(packet?.derivedSnapshots).map((snapshot) =>
    mapDerivedSnapshot(snapshot, nodeLookup, rawEvent?.id || packet?.eventId || null, warnings)
  )

  if (derivedSnapshots.length === 0) {
    derivedSnapshots.push(
      ...safeArray(packet?.derivedInput).map((snapshot) =>
        mapDerivedSnapshot(snapshot, nodeLookup, rawEvent?.id || packet?.eventId || null, warnings)
      )
    )
  }

  const reflectionUpdates = safeArray(packet?.reflectionUpdates).map(mapReflectionUpdate)

  if (reflectionUpdates.length === 0) {
    reflectionUpdates.push(...safeArray(packet?.reflectionInput).map(mapReflectionUpdate))
  }

  if (!rawEvent) {
    warnings.push('raw_event_missing_for_persistence')
  }

  return {
    traceId: packet?.traceId || options?.traceId || null,
    eventId: packet?.eventId || options?.eventId || rawEvent?.id || null,
    threadId: packet?.threadId || options?.threadId || rawEvent?.thread_id || null,
    rawEvent,
    nodes,
    entityProfiles,
    objectProfiles,
    locationProfiles,
    facts,
    episodes,
    edges,
    nodeEventLinks,
    episodeEventLinks,
    derivedSnapshots,
    reflectionUpdates,
    warnings
  }
}

function createRepositoryBundle({ client } = {}) {
  return {
    memoryEvents: createMemoryEventsRepository({ client }),
    memoryNodes: createMemoryNodesRepository({ client }),
    entityProfiles: createEntityProfilesRepository({ client }),
    objectProfiles: createObjectProfilesRepository({ client }),
    locationProfiles: createLocationProfilesRepository({ client }),
    factRecords: createFactRecordsRepository({ client }),
    episodeRecords: createEpisodeRecordsRepository({ client }),
    memoryEdges: createMemoryEdgesRepository({ client }),
    nodeEventLinks: createNodeEventLinksRepository({ client }),
    episodeEventLinks: createEpisodeEventLinksRepository({ client }),
    derivedSnapshots: createDerivedSnapshotsRepository({ client }),
    reflectionUpdates: createReflectionUpdatesRepository({ client })
  }
}

function buildPersistedTargetsPreview(packet = {}) {
  return [
    ...safeArray(packet?.nodes).slice(0, 3).map((node) => `node:${node.id}`),
    ...safeArray(packet?.facts).slice(0, 2).map((fact) => `fact:${fact.node_id}`),
    ...safeArray(packet?.episodes).slice(0, 2).map((episode) => `episode:${episode.node_id}`),
    ...safeArray(packet?.edges).slice(0, 2).map((edge) => `edge:${edge.id}`)
  ]
}

async function persistPacketWithRepositories(packet, repositories, result, options = {}) {
  const strictMode = options?.strictMode === true

  async function runStage(stage, action) {
    try {
      return await action()
    } catch (error) {
      result.errors.push(buildErrorMessage(stage, error))

      if (strictMode) {
        throw error
      }

      return null
    }
  }

  if (packet.rawEvent?.id) {
    await runStage('memory_events', async () => {
      const created = await repositories.memoryEvents.createMemoryEvent(packet.rawEvent)

      if (created) {
        result.counts.createdEvents += 1
      }
    })
  }

  for (const node of safeArray(packet.nodes)) {
    await runStage('memory_nodes', async () => {
      const created = await repositories.memoryNodes.createMemoryNode({
        id: node.id,
        node_type: node.node_type,
        status: node.status,
        canonical_name: node.canonical_name,
        summary_short: node.summary_short,
        summary_long: node.summary_long,
        embedding: node.embedding,
        importance_score: node.importance_score,
        salience_score: node.salience_score,
        confidence_score: node.confidence_score,
        recall_count: node.recall_count,
        last_recalled_at: node.last_recalled_at,
        last_updated_at: node.last_updated_at,
        created_at: node.created_at
      })

      if (created) {
        result.counts.createdNodes += 1
        return
      }

      const updated = await repositories.memoryNodes.updateMemoryNode(node.id, {
        node_type: node.node_type,
        status: node.status,
        canonical_name: node.canonical_name,
        summary_short: node.summary_short,
        summary_long: node.summary_long,
        embedding: node.embedding,
        importance_score: node.importance_score,
        salience_score: node.salience_score,
        confidence_score: node.confidence_score,
        recall_count: node.recall_count,
        last_recalled_at: node.last_recalled_at,
        last_updated_at: node.last_updated_at
      })

      if (updated) {
        result.counts.updatedNodes += 1
      }
    })
  }

  for (const profile of safeArray(packet.entityProfiles)) {
    await runStage('entity_profiles', async () => {
      const persisted = await repositories.entityProfiles.upsertEntityProfile(profile)

      if (persisted) {
        result.counts.createdEntityProfiles += 1
      }
    })
  }

  for (const profile of safeArray(packet.objectProfiles)) {
    await runStage('object_profiles', async () => {
      const persisted = await repositories.objectProfiles.upsertObjectProfile(profile)

      if (persisted) {
        result.counts.createdObjectProfiles += 1
      }
    })
  }

  for (const profile of safeArray(packet.locationProfiles)) {
    await runStage('location_profiles', async () => {
      const persisted = await repositories.locationProfiles.upsertLocationProfile(profile)

      if (persisted) {
        result.counts.createdLocationProfiles += 1
      }
    })
  }

  for (const fact of safeArray(packet.facts)) {
    await runStage('fact_records', async () => {
      const created = await repositories.factRecords.createFactRecord(fact)

      if (created) {
        result.counts.createdFacts += 1
        return
      }

      const updated = await repositories.factRecords.updateFactRecord(fact.node_id, {
        subject_node_id: fact.subject_node_id,
        predicate: fact.predicate,
        object_node_id: fact.object_node_id,
        object_text: fact.object_text,
        qualifier_json: fact.qualifier_json,
        valid_time_start: fact.valid_time_start,
        valid_time_end: fact.valid_time_end,
        confidence_score: fact.confidence_score,
        source_count: fact.source_count,
        last_supported_at: fact.last_supported_at,
        last_contradicted_at: fact.last_contradicted_at
      })

      if (updated) {
        result.counts.updatedFacts += 1
      }
    })
  }

  for (const episode of safeArray(packet.episodes)) {
    await runStage('episode_records', async () => {
      const created = await repositories.episodeRecords.createEpisodeRecord(episode)

      if (created) {
        result.counts.createdEpisodes += 1
        return
      }

      const updated = await repositories.episodeRecords.updateEpisodeRecord(episode.node_id, {
        title: episode.title,
        episode_type: episode.episode_type,
        started_at: episode.started_at,
        ended_at: episode.ended_at,
        location_node_id: episode.location_node_id,
        summary_short: episode.summary_short,
        summary_long: episode.summary_long,
        atmosphere_summary: episode.atmosphere_summary,
        mood_summary: episode.mood_summary,
        shift_summary: episode.shift_summary,
        emotional_weight: episode.emotional_weight,
        novelty_score: episode.novelty_score,
        resolved_state: episode.resolved_state,
        source_event_count: episode.source_event_count
      })

      if (updated) {
        result.counts.updatedEpisodes += 1
      }
    })
  }

  for (const edge of safeArray(packet.edges)) {
    await runStage('memory_edges', async () => {
      const created = await repositories.memoryEdges.createMemoryEdge(edge)

      if (created) {
        result.counts.createdEdges += 1
        return
      }

      await repositories.memoryEdges.updateMemoryEdge(edge.id, {
        from_node_id: edge.from_node_id,
        to_node_id: edge.to_node_id,
        edge_type: edge.edge_type,
        weight: edge.weight,
        confidence_score: edge.confidence_score,
        created_from_event_id: edge.created_from_event_id,
        last_updated_at: edge.last_updated_at
      })
    })
  }

  await runStage('node_event_links', async () => {
    const created = await repositories.nodeEventLinks.createNodeEventLinks(packet.nodeEventLinks)
    result.counts.createdNodeEventLinks += Number(created || 0)
  })

  await runStage('episode_event_links', async () => {
    const created =
      await repositories.episodeEventLinks.createEpisodeEventLinks(packet.episodeEventLinks)
    result.counts.createdEpisodeEventLinks += Number(created || 0)
  })

  for (const snapshot of safeArray(packet.derivedSnapshots)) {
    await runStage('derived_snapshots', async () => {
      const created = await repositories.derivedSnapshots.createDerivedSnapshot(snapshot)

      if (created) {
        result.counts.createdDerivedSnapshots += 1
      }
    })
  }

  for (const update of safeArray(packet.reflectionUpdates)) {
    await runStage('reflection_updates', async () => {
      const created = await repositories.reflectionUpdates.createReflectionUpdate(update)

      if (created) {
        result.counts.createdReflectionUpdates += 1
      }
    })
  }
}

async function persistMemoryStoragePacket(storagePacket = {}, options = {}) {
  const startedAt = Date.now()
  const normalizedPacket = normalizeStoragePacket(storagePacket, options)
  const result = buildEmptyResult(normalizedPacket.traceId, normalizedPacket.eventId)

  result.warnings.push(...safeArray(normalizedPacket.warnings))

  const itemCount =
    safeArray(normalizedPacket.nodes).length +
    safeArray(normalizedPacket.entityProfiles).length +
    safeArray(normalizedPacket.objectProfiles).length +
    safeArray(normalizedPacket.locationProfiles).length +
    safeArray(normalizedPacket.facts).length +
    safeArray(normalizedPacket.episodes).length +
    safeArray(normalizedPacket.edges).length +
    safeArray(normalizedPacket.nodeEventLinks).length +
    safeArray(normalizedPacket.episodeEventLinks).length +
    safeArray(normalizedPacket.derivedSnapshots).length +
    safeArray(normalizedPacket.reflectionUpdates).length +
    (normalizedPacket.rawEvent?.id ? 1 : 0)

  if (itemCount === 0) {
    await logPersistence({
      traceId: normalizedPacket.traceId,
      eventId: normalizedPacket.eventId,
      threadId: normalizedPacket.threadId,
      status: 'success',
      durationMs: Date.now() - startedAt,
      warnings: result.warnings,
      errors: [],
      counts: result.counts,
      note: 'storage_packet_empty_nothing_persisted',
      createdNodesCount: 0,
      updatedNodesCount: 0,
      createdFactsCount: 0,
      updatedFactsCount: 0,
      createdEpisodesCount: 0,
      updatedEpisodesCount: 0,
      createdEdgesCount: 0,
      createdLinksCount: 0,
      persistedTargetsPreview: []
    })

    return result
  }

  const executePersistence = async (client = null, strictMode = false) => {
    const repositories = options?.repositories || createRepositoryBundle({ client })
    await persistPacketWithRepositories(normalizedPacket, repositories, result, { strictMode })
  }

  try {
    if (options?.useTransaction === false || options?.repositories) {
      await executePersistence(options?.client || null, false)
    } else {
      const transactionRunner = options?.withTransaction || withTransaction

      await transactionRunner(
        async (client) => {
          await executePersistence(client, true)
        },
        options
      )
    }
  } catch (error) {
    result.status = 'failed'
    result.errors.push(buildErrorMessage('transaction', error))
    result.counts = cloneCounts()
    result.warnings.push('transaction_rolled_back')

    await logPersistence({
      traceId: normalizedPacket.traceId,
      eventId: normalizedPacket.eventId,
      threadId: normalizedPacket.threadId,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      warnings: result.warnings,
      errors: result.errors,
      counts: result.counts,
      note: 'transaction_boundary_failed',
      createdNodesCount: 0,
      updatedNodesCount: 0,
      createdFactsCount: 0,
      updatedFactsCount: 0,
      createdEpisodesCount: 0,
      updatedEpisodesCount: 0,
      createdEdgesCount: 0,
      createdLinksCount: 0,
      persistedTargetsPreview: []
    })

    return result
  }

  result.status =
    result.errors.length === 0
      ? 'success'
      : hasAnyWrites(result.counts)
        ? 'partial'
        : 'failed'

  await logPersistence({
    traceId: normalizedPacket.traceId,
    eventId: normalizedPacket.eventId,
    threadId: normalizedPacket.threadId,
    status: result.status,
    durationMs: Date.now() - startedAt,
    warnings: result.warnings,
    errors: result.errors,
    counts: result.counts,
    note:
      options?.useTransaction === false || options?.repositories
        ? 'transaction_boundary_not_enabled'
        : 'postgres_persistence_completed',
    createdNodesCount: result.counts.createdNodes,
    updatedNodesCount: result.counts.updatedNodes,
    createdFactsCount: result.counts.createdFacts,
    updatedFactsCount: result.counts.updatedFacts,
    createdEpisodesCount: result.counts.createdEpisodes,
    updatedEpisodesCount: result.counts.updatedEpisodes,
    createdEdgesCount: result.counts.createdEdges,
    createdLinksCount:
      result.counts.createdNodeEventLinks + result.counts.createdEpisodeEventLinks,
    persistedTargetsPreview: buildPersistedTargetsPreview(normalizedPacket)
  })

  return result
}

module.exports = {
  persistMemoryStoragePacket,
  normalizeStoragePacket,
  createRepositoryBundle
}
