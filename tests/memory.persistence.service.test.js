'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeStoragePacket
} = require('../src/core/memory/persistence/persistence.service')

test('normalizeStoragePacket maps current storage-resolution packet into persistence payload', () => {
  const normalized = normalizeStoragePacket(
    {
      traceId: 'trace-1',
      eventId: 'evt-1',
      threadId: 'thread-1',
      nodeResolutions: [
        {
          nodeResolutionId: 'node:hero',
          nodeType: 'entity',
          displayNameSeed: 'Hu Tao',
          canonicalNameSeed: 'Hu Tao',
          aliasSeeds: ['Director Hu'],
          summarySeed: 'Playful director',
          summaryLongSeed: 'Hu Tao jokes but keeps control of the scene.',
          confidenceSeed: 0.82,
          importanceSeed: 'high'
        },
        {
          nodeResolutionId: 'node:parlor',
          nodeType: 'location',
          displayNameSeed: 'Wangsheng Funeral Parlor',
          canonicalNameSeed: 'Wangsheng Funeral Parlor',
          summarySeed: 'Primary location'
        }
      ],
      profileUpdates: {
        entities: [
          {
            nodeResolutionId: 'node:hero',
            displayName: 'Hu Tao',
            aliases: ['Director Hu'],
            relationshipSummary: 'Close to the user',
            tagSeeds: ['playful']
          }
        ],
        objects: [],
        locations: [
          {
            nodeResolutionId: 'node:parlor',
            displayName: 'Wangsheng Funeral Parlor',
            meaningSummary: 'Workplace'
          }
        ]
      },
      factResolutions: [
        {
          factResolutionId: 'fact:1',
          subjectSeed: 'Hu Tao',
          predicateSeed: 'works_at',
          objectNodeHint: 'Wangsheng Funeral Parlor',
          objectTextSeed: null,
          qualifiers: {
            confidenceSeed: 0.7
          }
        }
      ],
      episodeResolutions: [
        {
          episodeResolutionId: 'episode:1',
          episodeType: 'scene',
          titleSeed: 'At the parlor',
          summaryShortSeed: 'Meeting in the office',
          locationHints: ['Wangsheng Funeral Parlor']
        }
      ],
      edgeResolutions: [
        {
          edgeResolutionId: 'edge:1',
          edgeType: 'located_in',
          fromNodeHints: ['Hu Tao'],
          toNodeHints: ['Wangsheng Funeral Parlor'],
          confidenceSeed: 0.5
        }
      ],
      nodeEventLinks: [
        {
          nodeResolutionId: 'node:hero',
          eventId: 'evt-1',
          linkRole: 'origin'
        }
      ],
      episodeEventLinks: [
        {
          episodeResolutionId: 'episode:1',
          eventId: 'evt-1',
          positionIndex: 0
        }
      ],
      derivedInput: [
        {
          derivedInputId: 'derived:1',
          derivedType: 'entity_impression',
          targetHints: ['Hu Tao'],
          summarySeed: 'Warm but chaotic'
        }
      ],
      reflectionInput: [
        {
          reflectionInputId: 'reflection:1',
          summarySeed: 'Needs profile refinement'
        }
      ]
    },
    {
      rawEvent: {
        id: 'evt-1',
        threadId: 'thread-1',
        role: 'user',
        text: 'Tell me about Hu Tao',
        timestamp: '2026-04-23T12:00:00.000Z'
      }
    }
  )

  assert.equal(normalized.traceId, 'trace-1')
  assert.equal(normalized.rawEvent.id, 'evt-1')
  assert.equal(normalized.nodes.length, 2)
  assert.equal(normalized.entityProfiles.length, 1)
  assert.equal(normalized.locationProfiles.length, 1)
  assert.equal(normalized.facts[0].subject_node_id, 'node:hero')
  assert.equal(normalized.facts[0].object_node_id, 'node:parlor')
  assert.equal(normalized.episodes[0].location_node_id, 'node:parlor')
  assert.equal(normalized.edges[0].from_node_id, 'node:hero')
  assert.equal(normalized.edges[0].to_node_id, 'node:parlor')
  assert.equal(normalized.derivedSnapshots[0].node_id, 'node:hero')
  assert.equal(normalized.reflectionUpdates[0].id, 'reflection:1')
  assert.deepEqual(normalized.warnings, [])
})
