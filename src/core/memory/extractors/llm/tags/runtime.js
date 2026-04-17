'use strict'

const env = require('../../../../config/env')
const { generateRawCompletion } = require('../../../../services/llm.service')
const { buildSemanticTagsPatchPrompt } = require('./prompt')
const {
  parseSemanticTagsPatch,
  applySemanticTagsPatch
} = require('./normalize')

const TAG_MODEL =
  env.MEMORY_MODEL ||
  env.MODEL ||
  'openai/gpt-5.4-nano'

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function needsSemanticTagsPatch(packet) {
  const candidates = safeArray(packet?.candidates)
  if (!candidates.length) return false

  return candidates.some((candidate) => {
    const tags = safeArray(candidate?.semantic?.tags)
    const flags = safeArray(candidate?.flags)
    return tags.length === 0 || flags.includes('invalid_semantic_tags')
  })
}

async function runSemanticTagsPatch({ event, packet }) {
  if (!needsSemanticTagsPatch(packet)) {
    return {
      model: TAG_MODEL,
      patch: { tagUpdates: [] },
      applied: false
    }
  }

  const prompt = buildSemanticTagsPatchPrompt({
    event,
    candidates: packet?.candidates || []
  })

  const response = await generateRawCompletion({
    prompt,
    model: TAG_MODEL
  })

  const raw =
    response?.text ||
    response?.content ||
    response?.output_text ||
    ''

  const patch = parseSemanticTagsPatch(raw)
  const nextPacket = applySemanticTagsPatch(packet, patch)

  return {
    model: response?.model || TAG_MODEL,
    patch,
    packet: nextPacket,
    applied: true
  }
}

module.exports = {
  needsSemanticTagsPatch,
  runSemanticTagsPatch
}