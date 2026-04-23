'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildPersistencePacket } = require('../../../../src/core/memory/extractors/llm/storage-resolution/build-persistence-packet')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('buildPersistencePacket returns final persistence packet contract without writing anywhere', () => {
  const packet = buildPersistencePacket(
    buildCandidatePool({
      rawEvent: {
        id: 'evt-1'
      },
      candidates: [
        buildCandidate({
          kind: 'entity_candidate',
          sourcePass: 'entity-object-location',
          routingTargets: ['node_resolution'],
          payload: { name: 'Ху Тао' }
        }),
        buildCandidate({
          candidateId: 'fact-1',
          kind: 'fact_candidate',
          sourcePass: 'fact',
          routingTargets: ['fact_resolution'],
          payload: { subject: 'Ху Тао', predicate: 'likes', object: 'чай' }
        }),
        buildCandidate({
          candidateId: 'ep-1',
          kind: 'episode_candidate',
          sourcePass: 'episode',
          routingTargets: ['episode_resolution', 'derived_input'],
          payload: { location: 'Ли Юэ' }
        }),
        buildCandidate({
          candidateId: 'edge-1',
          kind: 'relationship_signal',
          sourcePass: 'relationship-social',
          routingTargets: ['edge_resolution', 'derived_input'],
          payload: { from: 'Ху Тао', to: 'Пользователь' }
        }),
        buildCandidate({
          candidateId: 'refl-1',
          kind: 'open_loop_candidate',
          sourcePass: 'phase-open-loop',
          routingTargets: ['reflection_queue']
        })
      ]
    })
  )

  assert.equal(packet.traceId, 'trace-1')
  assert.deepEqual(packet.rawEvent, { id: 'evt-1' })
  assert.ok(Array.isArray(packet.nodes))
  assert.ok(Array.isArray(packet.entityProfiles))
  assert.ok(Array.isArray(packet.objectProfiles))
  assert.ok(Array.isArray(packet.locationProfiles))
  assert.ok(Array.isArray(packet.facts))
  assert.ok(Array.isArray(packet.episodes))
  assert.ok(Array.isArray(packet.edges))
  assert.ok(Array.isArray(packet.nodeEventLinks))
  assert.ok(Array.isArray(packet.episodeEventLinks))
  assert.ok(Array.isArray(packet.derivedSnapshots))
  assert.ok(Array.isArray(packet.reflectionUpdates))
  assert.equal(packet.nodes.length, 1)
  assert.equal(packet.facts.length, 1)
  assert.equal(packet.episodes.length, 1)
  assert.equal(packet.edges.length, 1)
  assert.equal(packet.reflectionUpdates.length, 1)
})
