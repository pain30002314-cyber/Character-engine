'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildNodeEventLinks } = require('../../../../src/core/memory/extractors/llm/storage-resolution/build-node-event-links')

test('buildNodeEventLinks links node resolutions back to event id', () => {
  const result = buildNodeEventLinks({
    candidatePool: {
      eventId: 'evt-1'
    },
    nodeResolutions: [
      {
        nodeResolutionId: 'node-1',
        candidateKind: 'entity_candidate'
      }
    ]
  })

  assert.equal(result[0].eventId, 'evt-1')
  assert.equal(result[0].linkRole, 'mention')
})
