'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  renderAllowedKindsBlock
} = require('../../../../src/core/memory/extractors/llm/prompts/blocks/allowed-kinds.block')

test('renderAllowedKindsBlock shows only local allowed kinds for each pass', () => {
  const factBlock = renderAllowedKindsBlock('fact')
  const episodeBlock = renderAllowedKindsBlock('episode')

  assert.match(factBlock, /fact_candidate — отдельное утверждение или наблюдаемый факт/)
  assert.match(factBlock, /fact_support_signal — сигнал, что один факт подтверждает другой/)
  assert.equal(factBlock.includes('episode_candidate'), false)

  assert.match(episodeBlock, /episode_candidate — сцена или событие, значимое как эпизод памяти/)
  assert.match(episodeBlock, /scene_progression_signal — сигнал изменения, движения или продвижения сцены/)
  assert.equal(episodeBlock.includes('fact_candidate'), false)
})

test('renderAllowedKindsBlock forbids inventing new kinds', () => {
  const block = renderAllowedKindsBlock('emotion-atmosphere-significance')

  assert.match(block, /Не придумывай новые kind\./)
  assert.match(block, /Не добавляй уточнения к kind\./)
  assert.match(block, /Если ни один kind не подходит — не создавай candidate\./)
})
