'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeKind } = require('../../../../src/core/memory/extractors/llm/normalization/normalize-kind')

test('normalizeKind keeps valid kind inside source pass domain', () => {
  const result = normalizeKind({ rawKind: 'fact_candidate' }, 'fact')

  assert.equal(result.normalizedValue, 'fact_candidate')
  assert.equal(result.flags.includes('kind_fallback_from_source_pass'), false)
})

test('normalizeKind falls back to base fact kind for foreign known raw kind', () => {
  const result = normalizeKind({ rawKind: 'episode_candidate' }, 'fact')

  assert.equal(result.normalizedValue, 'fact_candidate')
  assert.equal(result.sourceValue, 'episode_candidate')
  assert.ok(result.flags.includes('kind_fallback_from_source_pass'))
  assert.ok(result.flags.includes('kind_not_allowed_for_pass'))
  assert.match(result.warnings[0], /kind_fallback_from_source_pass:episode_candidate:fact_candidate/)
})

test('normalizeKind falls back to base fact kind for free-form raw kind', () => {
  const result = normalizeKind({ rawKind: 'проверка_логирования' }, 'fact')

  assert.equal(result.normalizedValue, 'fact_candidate')
  assert.equal(result.sourceValue, 'проверка_логирования')
  assert.ok(result.flags.includes('kind_fallback_from_source_pass'))
  assert.ok(result.flags.includes('kind_not_allowed_for_pass'))
})

test('normalizeKind falls back in emotion pass without semantic guessing', () => {
  const result = normalizeKind(
    { rawKind: 'эмоциональный_сдвиг_раздражение' },
    'emotion-atmosphere-significance'
  )

  assert.equal(result.normalizedValue, 'emotional_state_candidate')
  assert.ok(result.flags.includes('kind_fallback_from_source_pass'))
})

test('normalizeKind returns unknown_candidate_kind for unknown source pass', () => {
  const result = normalizeKind({ rawKind: 'whatever' }, 'unknown-pass')

  assert.equal(result.normalizedValue, 'unknown_candidate_kind')
  assert.ok(result.flags.includes('unknown_source_pass_for_kind_fallback'))
})
