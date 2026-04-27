'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { runLlmExtractionRuntime } = require('../../../../src/core/memory/extractors/llm/runtime')
const { getExtractorPassByKey } = require('../../../../src/core/memory/extractors/llm/passes/registry')
const { runSingleExtractorPass } = require('../../../../src/core/memory/extractors/llm/shared/run-single-pass')

const RUN_LIVE = process.env.RUN_LLM_LIVE_TESTS === 'true'
const liveTest = RUN_LIVE ? test : test.skip

const ALLOWED_KINDS_BY_PASS = {
  'entity-object-location': [
    'entity_candidate',
    'object_candidate',
    'location_candidate',
    'alias_signal',
    'role_signal'
  ],
  fact: [
    'fact_candidate',
    'temporal_fact_candidate',
    'fact_support_signal',
    'fact_contradiction_signal',
    'fact_refinement_signal'
  ],
  episode: [
    'episode_candidate',
    'micro_episode_candidate',
    'situational_context_signal',
    'local_interaction_signal',
    'participant_signal',
    'scene_location_signal',
    'scene_progression_signal'
  ],
  'phase-open-loop': [
    'phase_transition_candidate',
    'phase_marker_signal',
    'plan_marker_signal',
    'milestone_signal',
    'open_loop_candidate',
    'deferred_topic_signal',
    'pending_step_signal',
    'dependency_signal'
  ],
  'cognition-realization': [
    'realization_candidate',
    'cognitive_update_candidate',
    'reframing_signal',
    'interpretation_shift_signal',
    'certainty_shift_signal'
  ],
  'emotion-atmosphere-significance': [
    'emotional_state_candidate',
    'emotional_shift_candidate',
    'atmosphere_candidate',
    'tone_signal',
    'significance_candidate',
    'emphasis_signal'
  ],
  'relationship-social': [
    'relationship_candidate',
    'collaboration_signal',
    'vulnerability_signal',
    'openness_signal',
    'boundary_signal',
    'addressing_signal'
  ]
}

function makeEvent(text, idSuffix = 'bright') {
  return {
    id: `live-test-${idSuffix}-${Date.now()}`,
    threadId: 'telegram:live-test',
    role: 'user',
    platform: 'telegram',
    channel: 'text',
    timestamp: '2026-04-24T08:30:00.000+07:00',
    text,
    meta: {
      username: 'AndreyBakhtin1',
      speakerName: 'AndreyBakhtin1'
    },
    rawPayload: {
      test: true,
      source: 'live-bright-memory-logic.test.js'
    }
  }
}

function blob(candidate) {
  return [
    candidate.kind,
    candidate.text,
    candidate.summary,
    ...(Array.isArray(candidate.tags) ? candidate.tags : []),
    JSON.stringify(candidate.payload || {})
  ]
    .join(' ')
    .toLowerCase()
}

function includesAny(candidate, words) {
  const source = blob(candidate)
  return words.some((word) => source.includes(String(word).toLowerCase()))
}

function collectRuntimeCandidates(result) {
  const successfulPassCandidates =
    result?.orchestration?.passes?.successful?.flatMap((passResult) =>
      (passResult.candidates || []).map((candidate) => ({
        ...candidate,
        sourcePass: candidate.sourcePass || passResult.sourcePass || passResult.extractorKey
      }))
    ) || []

  return [
    ...successfulPassCandidates,
    ...(Array.isArray(result?.candidates) ? result.candidates : []),
    ...(Array.isArray(result?.candidatePool?.candidates) ? result.candidatePool.candidates : []),
    ...(Array.isArray(result?.orchestration?.candidates) ? result.orchestration.candidates : []),
    ...(Array.isArray(result?.orchestration?.candidatePool?.candidates) ? result.orchestration.candidatePool.candidates : []),
    ...(Array.isArray(result?.orchestration?.nextStage?.merge?.candidates) ? result.orchestration.nextStage.merge.candidates : []),
    ...(Array.isArray(result?.orchestration?.nextStage?.merge?.candidatePool?.candidates) ? result.orchestration.nextStage.merge.candidatePool.candidates : []),
    ...(Array.isArray(result?.orchestration?.nextStage?.lifecycle?.routed?.candidates) ? result.orchestration.nextStage.lifecycle.routed.candidates : [])
  ].filter(Boolean)
}

function uniqueCandidates(candidates) {
  const seen = new Set()
  const result = []

  for (const candidate of candidates) {
    const key = candidate.candidateId || `${candidate.sourcePass}:${candidate.kind}:${candidate.text}:${candidate.summary}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(candidate)
  }

  return result
}

function assertCandidateContract(candidate, passKey) {
  const allowedKinds = ALLOWED_KINDS_BY_PASS[passKey]
  assert.ok(allowedKinds, `неизвестный passKey: ${passKey}`)

  assert.ok(
    allowedKinds.includes(candidate.kind),
    `kind должен быть из allowed list pass=${passKey}, получил ${candidate.kind}\n${JSON.stringify(candidate, null, 2)}`
  )

  assert.ok(
    ['низкая', 'средняя', 'высокая'].includes(candidate.importance),
    `importance должна быть строкой низкая|средняя|высокая, получил ${candidate.importance}\n${JSON.stringify(candidate, null, 2)}`
  )

  assert.equal(
    typeof candidate.importance,
    'string',
    `importance не должна быть числом\n${JSON.stringify(candidate, null, 2)}`
  )

  assert.equal(typeof candidate.text, 'string', 'candidate.text должен быть строкой')
  assert.equal(typeof candidate.summary, 'string', 'candidate.summary должен быть строкой')
  assert.notEqual(
    candidate.kind,
    'unknown_candidate_kind',
    `при известном sourcePass kind не должен деградировать в unknown_candidate_kind\n${JSON.stringify(candidate, null, 2)}`
  )

  if (candidate.rawKind && candidate.rawKind !== candidate.kind) {
    assert.ok(
      Array.isArray(candidate.flags) && candidate.flags.includes('kind_fallback_from_source_pass'),
      `fallback-кандидат должен иметь flag kind_fallback_from_source_pass\n${JSON.stringify(candidate, null, 2)}`
    )
    assert.ok(
      Array.isArray(candidate.flags) && candidate.flags.includes('kind_not_allowed_for_pass'),
      `fallback-кандидат должен иметь flag kind_not_allowed_for_pass\n${JSON.stringify(candidate, null, 2)}`
    )
  }
}

async function runOnePass(passKey, text) {
  const pass = getExtractorPassByKey(passKey)
  assert.ok(pass, `pass не найден: ${passKey}`)

  const result = await runSingleExtractorPass({
    pass,
    event: makeEvent(text, passKey),
    eventWindow: [],
    context: {
      fastSignals: ['live test: яркая проверка логики kind']
    },
    runtime: {
      traceId: `live-kind-test:${passKey}:${Date.now()}`,
      llmRequest: {
        temperature: 0,
        maxTokens: 1800
      }
    }
  })

  if (!Array.isArray(result.candidates) || result.candidates.length === 0) {
    console.dir(
      {
        passKey,
        status: result.status,
        warnings: result.warnings,
        errors: result.errors,
        rawResponseText: result.rawResponseText,
        repairedJson: result.repairedJson,
        validation: result.validation
      },
      { depth: 8 }
    )
  }

  assert.ok(
    Array.isArray(result.candidates) && result.candidates.length > 0,
    `pass ${passKey} должен вернуть хотя бы одного кандидата`
  )

  return result.candidates
}

liveTest('LIVE: яркий факт извлекается как fact_candidate, а не как тема события', async () => {
  const text = [
    'Важный факт для памяти: в проекте Character Engine сейчас включен режим MEMORY_EXTRACTION_MODE=llm_only.',
    'Еще один факт: новый wide LLM extractor состоит из 7 параллельных extractor passes.',
    'Это не эмоция и не эпизод, а устойчивое техническое состояние проекта.'
  ].join('\n')

  const candidates = await runOnePass('fact', text)

  for (const candidate of candidates) {
    assertCandidateContract(candidate, 'fact')
  }

  assert.ok(
    candidates.some((candidate) => candidate.kind === 'fact_candidate' || candidate.kind === 'temporal_fact_candidate'),
    'должен быть fact_candidate или temporal_fact_candidate'
  )

  assert.ok(
    candidates.some((candidate) => includesAny(candidate, [
      'memory_extraction_mode',
      'llm_only',
      'wide',
      'llm',
      'extractor',
      'экстрактор',
      '7',
      'семь',
      'проход',
      'проходов',
      'passes',
      'character',
      'engine',
      'конфигурация',
      'состоит'
    ])),
    'факт должен быть именно про llm_only / wide extractor / 7 passes'
  )

  for (const candidate of candidates) {
    assert.notEqual(candidate.kind, 'проверка_логирования')
    assert.notEqual(candidate.kind, 'режим_llm_only')
    assert.notEqual(candidate.kind, 'wide_llm_extractor')
  }

  console.table(candidates.map((c) => ({
    pass: 'fact',
    kind: c.kind,
    importance: c.importance,
    summary: c.summary
  })))
})

liveTest('LIVE: яркий эпизод извлекается как episode_candidate или micro_episode_candidate', async () => {
  const text = [
    'Яркий эпизод: сегодня утром мы запустили Character Engine через npm start.',
    'После запуска все 7 LLM экстракторов отработали, а stage logs появились в отдельных JSONL-файлах.',
    'Мы специально отключили запись в data и проверяли только живой пайплайн.'
  ].join('\n')

  const candidates = await runOnePass('episode', text)

  for (const candidate of candidates) {
    assertCandidateContract(candidate, 'episode')
  }

  assert.ok(
    candidates.some((candidate) => candidate.kind === 'episode_candidate' || candidate.kind === 'micro_episode_candidate'),
    'должен быть episode_candidate или micro_episode_candidate'
  )

  assert.ok(
    candidates.some((candidate) => includesAny(candidate, ['npm start', '7 llm', 'экстракторов', 'jsonl', 'логи', 'пайплайн'])),
    'эпизод должен быть именно про запуск npm start, 7 экстракторов и JSONL-логи'
  )

  for (const candidate of candidates) {
    assert.notEqual(candidate.kind, 'запуск_пайплайна')
    assert.notEqual(candidate.kind, 'проверка_логирования')
  }

  console.table(candidates.map((c) => ({
    pass: 'episode',
    kind: c.kind,
    importance: c.importance,
    summary: c.summary
  })))
})

liveTest('LIVE: полный runtime на ярком сообщении сохраняет логику всех ключевых сигналов', async () => {
  process.env.MEMORY_DISABLE_PERSISTENCE_WRITE = 'true'

  const text = [
    'Устойчивый технический факт для памяти: Character Engine работает в режиме MEMORY_EXTRACTION_MODE=llm_only, а новый wide LLM extractor состоит из 7 параллельных extractor passes. Это конфигурация системы, а не эпизод и не эмоция.',
    'Яркий эпизод: сегодня утром мы после нескольких раздражающих ошибок запустили проект через npm start, увидели, что все 7 экстракторов отработали, а логи записались в отдельные JSONL-файлы.',
    'Я сначала думал, что kind должен описывать тему события, например "проверка логирования", но теперь понял: kind — это технический тип сигнала памяти.',
    'Мы закрыли этап настройки kind и теперь переходим к этапу проверки merge. Если merge не покажет overlapGroups больше нуля, мы вернемся к его эвристикам позже; после этого можно будет переходить к triage, routing и записи в Postgres.',
    'После успешного запуска стало спокойнее, хотя раздражение от кривых kind еще немного осталось.',
    'Брат, давай вместе аккуратно добьем этот слой без спешки.'
  ].join('\n')

  const result = await runLlmExtractionRuntime({
    event: makeEvent(text, 'full-runtime'),
    eventWindow: [],
    context: {
        fastSignals: [
          'есть яркий факт',
          'есть яркий эпизод',
          'есть осознание',
          'есть явный переход этапа',
          'есть open loop с условием возврата',
          'есть эмоция',
          'есть совместное действие'
        ]
    },
    runtime: {
      traceId: `live-bright-runtime:${Date.now()}`,
      llmRequest: {
        temperature: 0,
        maxTokens: 2200
      }
    }
  })

  const candidates = uniqueCandidates(collectRuntimeCandidates(result))

  if (candidates.length === 0) {
    console.dir(
      {
        resultKeys: Object.keys(result || {}),
        service: result?.service,
        warnings: result?.warnings,
        orchestrationStatus: result?.orchestration?.status,
        passes: {
          configured: result?.orchestration?.passes?.configured,
          successful: result?.orchestration?.passes?.successful?.map((passResult) => ({
            sourcePass: passResult.sourcePass,
            status: passResult.status,
            candidateCount: Array.isArray(passResult.candidates) ? passResult.candidates.length : 0,
            warnings: passResult.warnings,
            errors: passResult.errors,
            rawResponseText: passResult.rawResponseText
          })),
          failed: result?.orchestration?.passes?.failed
        },
        candidatePool: result?.candidatePool
      },
      { depth: 10 }
    )
  }

  assert.ok(candidates.length > 0, 'должны появиться кандидаты')

  const mergeCandidates =
    result?.orchestration?.nextStage?.merge?.candidates ||
    result?.orchestration?.nextStage?.merge?.candidatePool?.candidates ||
    []
  const mergeMeta = result?.orchestration?.nextStage?.merge?.mergeMeta || result?.mergeMeta || null

  for (const candidate of candidates) {
    const passKey = candidate.sourcePass || candidate.extractorKey || candidate.sourcePasses?.[0]
    assert.ok(passKey, `у кандидата должен быть sourcePass\n${JSON.stringify(candidate, null, 2)}`)

    assertCandidateContract(candidate, passKey)
  }

const factCandidates = candidates.filter((candidate) =>
  candidate.sourcePass === 'fact' &&
  ['fact_candidate', 'temporal_fact_candidate', 'fact_support_signal', 'fact_refinement_signal'].includes(candidate.kind)
)

if (factCandidates.length === 0) {
  console.table(candidates.map((candidate) => ({
    pass: candidate.sourcePass,
    kind: candidate.kind,
    importance: candidate.importance,
    summary: candidate.summary,
    text: candidate.text
  })))
}

assert.ok(
  factCandidates.length > 0,
  'полный runtime должен извлечь хотя бы один факт fact-pass-ом'
)

assert.ok(
  factCandidates.some((candidate) =>
    includesAny(candidate, [
      'wide',
      'llm',
      'extractor',
      'экстрактор',
      '7',
      'семь',
      'проход',
      'проходов',
      'character',
      'engine'
    ])
  ),
  'fact-pass должен извлечь факт про Character Engine / wide LLM extractor / 7 проходов'
)

  assert.ok(
    candidates.some((candidate) =>
      candidate.sourcePass === 'episode' &&
      ['episode_candidate', 'micro_episode_candidate'].includes(candidate.kind) &&
      includesAny(candidate, ['npm start', 'jsonl', 'логи', '7 экстракторов'])
    ),
    'полный runtime должен извлечь яркий эпизод именно episode-pass-ом'
  )

  assert.ok(
    candidates.some((candidate) =>
      candidate.sourcePass === 'cognition-realization' &&
      ['realization_candidate', 'cognitive_update_candidate', 'reframing_signal', 'interpretation_shift_signal'].includes(candidate.kind) &&
      includesAny(candidate, ['kind', 'технический тип', 'тема события'])
    ),
    'должно быть извлечено осознание: kind — технический тип, а не тема события'
  )

  assert.ok(
    candidates.some((candidate) =>
      candidate.sourcePass === 'phase-open-loop' &&
      ['pending_step_signal', 'open_loop_candidate', 'phase_transition_candidate', 'milestone_signal'].includes(candidate.kind) &&
      includesAny(candidate, ['merge', 'triage', 'routing', 'postgres', 'осталось'])
    ),
    'должен быть извлечен следующий шаг / open loop'
  )

  assert.ok(
    candidates.some((candidate) =>
      candidate.sourcePass === 'emotion-atmosphere-significance' &&
      ['emotional_state_candidate', 'emotional_shift_candidate', 'atmosphere_candidate'].includes(candidate.kind) &&
      includesAny(candidate, ['спокойнее', 'раздражение', 'ошибок'])
    ),
    'должен быть извлечен эмоциональный или атмосферный сигнал'
  )

  assert.ok(
    candidates.some((candidate) =>
      candidate.sourcePass === 'relationship-social' &&
      ['collaboration_signal', 'addressing_signal', 'relationship_candidate'].includes(candidate.kind) &&
      includesAny(candidate, ['брат', 'вместе', 'добьем'])
    ),
    'должен быть извлечен социальный/совместный сигнал'
  )

  const forbiddenThemeKinds = new Set([
    'проверка_логирования',
    'запуск_пайплайна',
    'wide_llm_extractor',
    'character_engine',
    'ошибка_kind',
    'режим_llm_only'
  ])

  for (const candidate of candidates) {
    assert.ok(
      !forbiddenThemeKinds.has(candidate.kind),
      `тема события не должна попадать в kind: ${candidate.kind}`
    )
  }

  if (candidates.length >= 5) {
    assert.ok(
      (mergeMeta?.overlapGroups || 0) > 0,
      `при богатом сообщении mergeMeta.overlapGroups должен быть > 0\n${JSON.stringify(mergeMeta, null, 2)}`
    )
    assert.ok(
      mergeCandidates.some((candidate) => Array.isArray(candidate.flags) && candidate.flags.includes('overlap_detected')),
      'хотя бы один merge candidate должен иметь flag overlap_detected'
    )
    assert.ok(
      mergeCandidates.some((candidate) => Array.isArray(candidate.relatedCandidateIds) && candidate.relatedCandidateIds.length > 0),
      'хотя бы один merge candidate должен иметь relatedCandidateIds'
    )
  }

  console.table(candidates.map((candidate) => ({
    pass: candidate.sourcePass,
    kind: candidate.kind,
    importance: candidate.importance,
    summary: candidate.summary
  })))
})
