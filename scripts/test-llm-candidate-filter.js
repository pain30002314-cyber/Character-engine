'use strict'

const {
  runExtractFilterObservePipeline
} = require('../src/core/memory/pipeline/extract-filter-observe.pipeline')
const {
  getTimeContext,
  toOffsetIso
} = require('../src/services/time-context.service')

function printSection(title, value) {
  console.log(`\n===== ${title} =====`)
  console.log(value)
}

async function run() {
  const timeContext = getTimeContext()
  const baseTime = new Date('2026-04-13T10:01:00.000Z')

  const event = {
    id: 'test_filter_event_1',
    threadId: 'telegram:test_chat',
    platform: 'telegram',
    channel: 'text',
    world: 'Earth',
    role: 'user',
    timestamp: toOffsetIso(baseTime, timeContext.utcOffsetMinutes),
    text: 'Мне приходится каждый раз заново передавать тебе это чувство',
    meta: {
      timezone: timeContext.timezone,
      utcOffsetMinutes: timeContext.utcOffsetMinutes,
      userDisplayName: null,
      characterDisplayName: null
    }
  }

  const result = await runExtractFilterObservePipeline({
    threadId: event.threadId,
    event
  })

  printSection('EVENT WINDOW', JSON.stringify(result.eventWindow, null, 2))
  printSection('EXTRACTOR PACKET', JSON.stringify(result.extractorPacket, null, 2))
  printSection('FILTER PACKET', JSON.stringify(result.filterPacket, null, 2))

  const summary = {
    extractorCandidateCount: Array.isArray(result.extractorPacket?.candidates)
      ? result.extractorPacket.candidates.length
      : 0,
    filteredCandidateCount: Array.isArray(result.filterPacket?.candidates)
      ? result.filterPacket.candidates.length
      : 0,
    batchSummary: result.filterPacket?.batch_summary || null,
    filterVersion: result.filterPacket?.filter_version || null
  }

  printSection('CHECKS', JSON.stringify(summary, null, 2))
  printSection('STATUS', 'OK')
}

run().catch((error) => {
  console.error('\n===== STATUS =====')
  console.error('FAILED')
  console.error(error)
  process.exit(1)
})
