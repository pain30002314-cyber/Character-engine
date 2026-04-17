'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { buildPrompt } = require('../src/core/memory/extractors/llm/prompt')

function buildParsedPrompt() {
  const raw = buildPrompt({
    event: {
      id: 'evt-1',
      threadId: 'thread-1',
      role: 'user',
      platform: 'telegram',
      channel: 'text',
      world: 'Earth',
      timestamp: '2026-04-16T12:00:00.000Z',
      text: 'Экстрактор пропатчил. Давай оценим как работает теперь.',
      meta: {}
    },
    eventWindow: [],
    identity: {
      coreUserRef: 'core_user:main',
      coreCharacterRef: 'core_character:active',
      userDisplayName: null,
      characterDisplayName: null
    }
  })

  return JSON.parse(raw)
}

function includesLine(list, expected) {
  return Array.isArray(list) && list.includes(expected)
}

test('prompt focuses on extraction instead of memory selection', () => {
  const prompt = buildParsedPrompt()
  const rules = prompt.instructions?.priorityRules || []
  const critical = prompt.instructions?.criticalRules || []

  assert.equal(
    includesLine(rules, 'Extract semantic signals even if they are technical, operational, or system-related.'),
    true
  )

  assert.equal(
    includesLine(rules, 'Focus on extraction, not memory selection.'),
    true
  )

  assert.equal(
    includesLine(critical, 'Do not filter candidates based on assumed memory importance.'),
    true
  )

  assert.equal(
    includesLine(critical, 'Do not drop candidates because they are technical, operational, or workflow-related.'),
    true
  )
})

test('prompt no longer requires semantic tags to be fully solved in extractor pass', () => {
  const prompt = buildParsedPrompt()
  const schemaPolicy = prompt.instructions?.schemaPolicy || []
  const compressionRules = prompt.instructions?.compressionRules || []
  const outputRequirements = prompt.outputRequirements || []

  assert.equal(
    includesLine(schemaPolicy, 'semantic.tags are optional and may be empty.'),
    true
  )

  assert.equal(
    includesLine(schemaPolicy, 'semantic.tags must be short English tags, not Russian phrases.'),
    false
  )

  assert.equal(
    includesLine(compressionRules, 'semantic.tags should usually contain 1 to 3 short tags, not long lists.'),
    false
  )

  assert.equal(
    includesLine(outputRequirements, 'semantic.tags may be empty.'),
    true
  )
})

test('prompt reduces schema pressure and does not require fake completeness', () => {
  const prompt = buildParsedPrompt()
  const critical = prompt.instructions?.criticalRules || []

  assert.equal(
    includesLine(critical, 'Every candidate must include kind and text.'),
    true
  )

  assert.equal(
    includesLine(critical, 'Other fields should be filled when confidently available.'),
    true
  )

  assert.equal(
    includesLine(critical, 'Do not invent fields just to satisfy schema completeness.'),
    true
  )

  assert.equal(
    includesLine(critical, 'Every candidate must include kind, semantic, references, evidence, temporal, memory, and source blocks.'),
    false
  )
})

test('prompt examples reflect tags as optional rather than mandatory output burden', () => {
  const prompt = buildParsedPrompt()
  const examples = Array.isArray(prompt.examples) ? prompt.examples : []

  const hasGoodExampleWithEmptyTags = examples.some((example) => {
    const candidate = example?.good?.candidates?.[0] || example?.good
    const tags = candidate?.semantic?.tags
    return Array.isArray(tags) && tags.length === 0
  })

  assert.equal(hasGoodExampleWithEmptyTags, true)
})

test('prompt still keeps english schema fields while human text remains russian', () => {
  const prompt = buildParsedPrompt()
  const languagePolicy = prompt.instructions?.languagePolicy || []
  const schemaPolicy = prompt.instructions?.schemaPolicy || []

  assert.equal(
    includesLine(languagePolicy, 'All human-readable text fields should be written in Russian.'),
    true
  )

  assert.equal(
    includesLine(languagePolicy, 'Schema identifiers and enumerations must remain in English.'),
    true
  )

  assert.equal(
    includesLine(schemaPolicy, 'semantic.class must be a short stable schema-like identifier in English snake_case or lower_case style.'),
    true
  )
})