'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveEpisodeCandidates } = require('../../../../src/core/memory/extractors/llm/storage-resolution/resolve-episode-candidates')
const { buildCandidatePool, buildCandidate } = require('../helpers')

test('resolveEpisodeCandidates maps micro episode aliases into episode resolution', () => {
  const result = resolveEpisodeCandidates(
    buildCandidatePool({
      candidates: [
        buildCandidate({
          kind: 'micro_episode_candidate',
          sourcePass: 'episode',
          routingTargets: ['episode_resolution']
        })
      ]
    })
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].episodeType, 'micro_scene')
})
