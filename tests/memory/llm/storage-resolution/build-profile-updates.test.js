'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildProfileUpdates } = require('../../../../src/core/memory/extractors/llm/storage-resolution/build-profile-updates')

test('buildProfileUpdates splits node resolutions by entity object location', () => {
  const result = buildProfileUpdates({
    nodeResolutions: [
      { nodeResolutionId: 'n1', nodeType: 'entity', displayNameSeed: 'Ху Тао' },
      { nodeResolutionId: 'n2', nodeType: 'object', displayNameSeed: 'Зонт' },
      { nodeResolutionId: 'n3', nodeType: 'location', displayNameSeed: 'Ли Юэ' }
    ]
  })

  assert.equal(result.entities.length, 1)
  assert.equal(result.objects.length, 1)
  assert.equal(result.locations.length, 1)
})
