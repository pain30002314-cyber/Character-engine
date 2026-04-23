'use strict'

const { writeMemoryDebug } = require('../../../debug/memory-debug.service')

function toErrorPacket(error) {
  return {
    message: error?.message || String(error || 'unknown_pass_error'),
    code: error?.code || null
  }
}

async function executeRegisteredPass(pass, input) {
  if (typeof pass?.execute !== 'function') {
    const error = new Error(`extractor_pass_execute_missing:${pass?.extractorKey || 'unknown'}`)
    error.code = 'extractor_pass_execute_missing'
    throw error
  }

  return pass.execute(input)
}

async function runAllExtractorPasses({
  passes = [],
  event,
  eventWindow = [],
  context = {},
  llm = {},
  runtime = {},
  flowConfig = {}
}) {
  const startedAt = Date.now()

  const jobs = passes.map((pass) =>
    executeRegisteredPass(pass, {
      pass,
      event,
      eventWindow,
      context,
      llm,
      runtime,
      flowConfig
    })
  )

  const settled = await Promise.allSettled(jobs)

  const successful = []
  const failed = []

  for (let index = 0; index < settled.length; index += 1) {
    const settlement = settled[index]
    const pass = passes[index]

    if (settlement.status === 'fulfilled') {
      if (settlement.value?.status === 'failed') {
        failed.push(settlement.value)
      } else {
        successful.push(settlement.value)
      }
      continue
    }

    failed.push({
      extractorKey: pass?.extractorKey || null,
      extractorName: pass?.extractorName || null,
      role: pass?.role || null,
      error: toErrorPacket(settlement.reason)
    })
  }

  const result = {
    total: passes.length,
    successful,
    failed,
    partialFailure: failed.length > 0,
    durationMs: Date.now() - startedAt
  }

  writeMemoryDebug({
    layer: 'llm-extractor-run-all-passes',
    timestamp: new Date().toISOString(),
    threadId: event?.threadId || null,
    messageId: event?.id || null,
    eventId: event?.id || null,
    sourceEventId: event?.id || null,
    input: {
      passes: passes.map((pass) => ({
        extractorKey: pass.extractorKey,
        extractorName: pass.extractorName,
        role: pass.role || null
      })),
      eventWindowSize: Array.isArray(eventWindow) ? eventWindow.length : 0
    },
    output: {
      successful: successful.map((item) => ({
        extractorKey: item.extractorKey,
        candidateCount: Array.isArray(item.candidates) ? item.candidates.length : 0,
        status: item.status
      })),
      failed: failed.map((item) => ({
        extractorKey: item?.extractorKey || null,
        candidateCount: Array.isArray(item?.candidates) ? item.candidates.length : 0,
        status: item?.status || 'rejected',
        error: item?.error || null
      }))
    },
    meta: {
      total: result.total,
      successful: successful.length,
      failed: failed.length,
      partialFailure: result.partialFailure,
      durationMs: result.durationMs
    },
    errors: failed.map((item) => item.error.message)
  })

  return result
}

module.exports = {
  runAllExtractorPasses
}
