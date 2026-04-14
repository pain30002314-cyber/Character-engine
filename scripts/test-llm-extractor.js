'use strict'

const { extractLlmClaims } = require('../src/core/memory/extractors/llm')
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

  const eventWindow = [
    {
      id: 'evt_prev_1',
      role: 'user',
      timestamp: toOffsetIso(new Date(baseTime.getTime() - 60_000), timeContext.utcOffsetMinutes),
      text: 'Я уже много раз целовался с тобой'
    },
    {
      id: 'evt_prev_2',
      role: 'assistant',
      timestamp: toOffsetIso(new Date(baseTime.getTime() - 50_000), timeContext.utcOffsetMinutes),
      text: 'И каждый раз это было впервые для меня...'
    }
  ]

  const event = {
    id: 'test_event_1',
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

  const result = await extractLlmClaims({
    event,
    eventWindow
  })

  printSection('FULL RESULT JSON', JSON.stringify(result, null, 2))

  const hasTopLevelPacket = Boolean(
    result &&
    typeof result === 'object' &&
    result.version === 1 &&
    result.strategy === 'llm_memory_candidates_v1' &&
    result.event &&
    result.context &&
    Array.isArray(result.candidates) &&
    result.temporal &&
    result.meta &&
    result.debug
  )

  const accidentallyReturnedOldClaims =
    result &&
    Object.prototype.hasOwnProperty.call(result, 'claims')

  const candidateCount = Array.isArray(result?.candidates)
    ? result.candidates.length
    : 0

  printSection(
    'CHECKS',
    JSON.stringify(
      {
        hasTopLevelPacket,
        accidentallyReturnedOldClaims,
        candidateCount,
        usedModel: result?.meta?.usedModel || null,
        promptVersion: result?.meta?.promptVersion || null,
        eventTimestamp: result?.event?.timestamp || null,
        timezone: result?.event?.meta?.timezone || null,
        utcOffsetMinutes: result?.event?.meta?.utcOffsetMinutes || null,
        warnings: result?.debug?.warnings || []
      },
      null,
      2
    )
  )

  if (!hasTopLevelPacket) {
    throw new Error('Extractor did not return valid llm_memory_candidates_v1 packet')
  }

  if (accidentallyReturnedOldClaims) {
    throw new Error('Extractor returned old claims format instead of candidates packet')
  }

  printSection('STATUS', 'OK')
}

run().catch((error) => {
  console.error('\n===== STATUS =====')
  console.error('FAILED')
  console.error(error)
  process.exit(1)
})