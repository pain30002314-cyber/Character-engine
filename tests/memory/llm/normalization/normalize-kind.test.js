'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeKind } = require('../../../../src/core/memory/extractors/llm/normalization/normalize-kind')

test('normalizeKind maps russian aliases and keeps unknown raw flags', () => {
  assert.equal(normalizeKind({ kind: 'факт' }, 'fact').normalizedValue, 'fact_candidate')
  assert.equal(normalizeKind({ kind: 'микро эпизод' }, 'episode').normalizedValue, 'micro_scene_candidate')
  assert.equal(normalizeKind({ kind: 'Микро-эпизод' }, 'episode').normalizedValue, 'micro_scene_candidate')

  const unknown = normalizeKind({ kind: 'что-то странное' }, 'fact')
  assert.equal(unknown.normalizedValue, 'unknown_candidate_kind')
  assert.ok(unknown.flags.includes('unknown_candidate_kind'))
  assert.ok(unknown.flags.includes('unknown_kind_raw'))
})
