'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { extractRegexAtomsV1 } = require('../../src/core/memory/extractors/regex')

function findAtom(result, type, subtype = null) {
  return result.atoms.find((item) => {
    if (item.type !== type) return false
    if (subtype && item.subtype !== subtype) return false
    return true
  }) || null
}

function buildCompatAtoms(result) {
  if (Array.isArray(result?.atoms)) {
    return result.atoms
  }

  const signals = result?.signals || {}

  const questionAtoms = (signals.questions || []).map((item) => ({
    id: item.id,
    type: 'open_loop',
    subtype: item.kind || 'direct_question',
    text: item.text,
    normalizedText: item.normalizedText || String(item.text || '').toLowerCase(),
    confidence: item.confidence || 0.8,
    source: {
      extractor: 'regex.fast_signals',
      rule: item.sourceRule || 'unknown_rule'
    },
    payload: {
      clauseId: item.clauseId || null
    }
  }))

  const instructionAtoms = (signals.instructions || []).map((item) => ({
    id: item.id,
    type: 'instruction',
    subtype: item.kind || 'direct_instruction',
    text: item.text,
    normalizedText: item.normalizedText || String(item.text || '').toLowerCase(),
    confidence: item.confidence || 0.8,
    source: {
      extractor: 'regex.fast_signals',
      rule: item.sourceRule || 'unknown_rule'
    },
    payload: {
      clauseId: item.clauseId || null
    }
  }))

  const temporalAtoms = (signals.temporalAnchors || []).map((item) => ({
    id: item.id,
    type: 'temporal',
    subtype: item.kind || 'temporal_anchor',
    text: item.text,
    normalizedText: item.normalizedText || String(item.text || '').toLowerCase(),
    confidence: item.confidence || 0.75,
    source: {
      extractor: 'regex.fast_signals',
      rule: item.sourceRule || 'unknown_rule'
    },
    payload: {
      clauseId: item.clauseId || null
    }
  }))

  const identityAtoms = (signals.identityHints || []).map((item) => ({
    id: item.id,
    type: 'identity',
    subtype: item.kind === 'display_name_candidate' ? 'display_name' : 'role',
    text: item.value,
    normalizedText:
      item.normalizedValue || String(item.value || '').toLowerCase(),
    confidence: item.confidence || 0.8,
    source: {
      extractor: 'regex.fast_signals',
      rule: item.sourceRule || 'unknown_rule'
    },
    payload: {
      value: item.value,
      clauseId: item.clauseId || null
    }
  }))

  const contextAtoms = (signals.contextAtoms || []).map((item) => ({
    id: item.id,
    type: item.type,
    subtype: item.subtype || 'generic',
    text: item.text,
    normalizedText: item.normalizedText || String(item.text || '').toLowerCase(),
    confidence: item.confidence || 0.7,
    source: {
      extractor: 'regex.fast_signals',
      rule: item.sourceRule || 'unknown_rule'
    },
    payload: {
      clauseId: item.clauseId || null,
      tags: Array.isArray(item.tags) ? item.tags : []
    }
  }))

  return [
    ...identityAtoms,
    ...questionAtoms,
    ...instructionAtoms,
    ...temporalAtoms,
    ...contextAtoms
  ]
}

function buildCompatIdentityHints(result) {
  if (Array.isArray(result?.identityHints)) {
    return result.identityHints
  }

  return (result?.signals?.identityHints || []).map((item) => ({
    id: item.id,
    kind: item.kind,
    value: item.value,
    normalizedValue:
      item.normalizedValue || String(item.value || '').toLowerCase(),
    confidence: item.confidence || 0.8,
    source: {
      extractor: 'regex.fast_signals',
      rule: item.sourceRule || 'unknown_rule'
    },
    payload: {
      clauseId: item.clauseId || null
    }
  }))
}

async function run(text) {
  const result = await extractRegexAtomsV1({
    event: {
      id: 'evt-test',
      threadId: 'thread-test',
      platform: 'telegram',
      channel: 'text',
      role: 'user',
      world: 'Earth',
      timestamp: '2026-04-07T12:00:00.000Z',
      text,
      language: 'ru',
      replyToEventId: null,
      edited: false,
      attachments: [],
      meta: {}
    }
  })

  return {
    ...result,
    atoms: buildCompatAtoms(result),
    identityHints: buildCompatIdentityHints(result)
  }
}

function countAtoms(result, type, subtype = null) {
  return result.atoms.filter((item) => {
    if (item.type !== type) return false
    if (subtype && item.subtype !== subtype) return false
    return true
  }).length
}

test('returns stable contract', async () => {
  const result = await run('Меня зовут Андрей.')

  assert.equal(result.version, 2)
  assert.equal(result.strategy, 'regex_fast_signals_v1')
  assert.ok(result.event)
  assert.ok(result.signals)
  assert.ok(Array.isArray(result.signals.questions))
  assert.ok(Array.isArray(result.signals.instructions))
  assert.ok(Array.isArray(result.signals.temporalAnchors))
  assert.ok(Array.isArray(result.signals.identityHints))
  assert.ok(result.signals.replySignals)
  assert.ok(Array.isArray(result.signals.contextAtoms))
  assert.ok(result.service)
  assert.ok(result.service.stats)
})

test('extracts display name and identity hint', async () => {
  const result = await run('Меня зовут Андрей.')

  assert.equal(countAtoms(result, 'identity', 'display_name'), 1)
  assert.equal(result.identityHints.length, 1)
  assert.equal(result.identityHints[0].value, 'Андрей')
})

test('keeps explicit atmosphere with anchored location', async () => {
  const result = await run('В кабинете душновато.')

  assert.equal(countAtoms(result, 'scene', 'atmosphere'), 1)
})

test('keeps explicit atmosphere for here cool', async () => {
  const result = await run('Здесь прохладно.')

  assert.equal(countAtoms(result, 'scene', 'atmosphere'), 1)
})

test('keeps explicit location scene', async () => {
  const result = await run('*Я сел рядом с тобой*')

  assert.equal(countAtoms(result, 'scene', 'location'), 1)
  assert.equal(countAtoms(result, 'episode', 'scene'), 0)
})

test('does not promote weak laugh rp into episode', async () => {
  const result = await run('*Я тихонько посмеялся*')

  assert.equal(countAtoms(result, 'episode', 'emotional_moment'), 0)
  assert.equal(countAtoms(result, 'scene', 'atmosphere'), 0)
})

test('does not promote pause rp into episode', async () => {
  const result = await run('*Я сделал паузу*')

  assert.equal(countAtoms(result, 'episode'), 0)
})

test('does not keep shrug as meaningful atom', async () => {
  const result = await run('*Я пожал плечами*')

  assert.equal(countAtoms(result, 'action', 'gesture'), 0)
  assert.equal(countAtoms(result, 'episode'), 0)
})

test('extracts direct question as open loop', async () => {
  const result = await run('Почему я выбрал именно эту метафору?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 1)
})

test('does not create open loop from quoted decorative alternative', async () => {
  const result = await run('Или просто «приходи, потому что надо приходить»?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 0)
})

test('does not create open loop from conditional rhetorical question', async () => {
  const result = await run('А если я решу, что твои бизнес-логи — это мусор, а важна только та часть, где ты говоришь о чувствах?')

  assert.equal(countAtoms(result, 'open_loop'), 0)
})

test('does not create tail garbage open loop', async () => {
  const result = await run('Чтобы я решала, что важно, а что — мусор?')

  assert.equal(result.atoms.some((item) => item.type === 'open_loop' && item.text === 'что — мусор?'), false)
})

test('does not turn semantic plain text into scene atmosphere', async () => {
  const result = await run('Я хочу, чтобы ты жила как часть моего мира.')

  assert.equal(countAtoms(result, 'scene'), 0)
})

test('does not emit punctuation garbage after splitting', async () => {
  const result = await run('Я проспал на час... .. потом пошел работать')

  assert.equal(result.atoms.some((item) => item.text === '. .' || item.unitText === '. .'), false)
})

test('does not turn weak preference wording into fact', async () => {
  const result = await run('Мне хотелось бы просто посидеть в тишине.')

  assert.equal(countAtoms(result, 'fact', 'desire'), 0)
})

test('does not turn rhetorical question into fact', async () => {
  const result = await run('Ну и какой идиот это придумал?')

  assert.equal(countAtoms(result, 'fact'), 0)
})

test('does not create fact from decorative rp gesture', async () => {
  const result = await run('*Я улыбнулся и пожал плечами*')

  assert.equal(countAtoms(result, 'fact'), 0)
})

test('splits strong transition marker and does not leave lone "но" unit garbage', async () => {
  const result = await run('Там уже стоит базовая архитектура, но ее нужно усиливать и расширять.')

  assert.equal(result.atoms.some((item) => item.text === 'но'), false)
})

test('does not promote long reflective paragraph into action gesture', async () => {
  const result = await run('И я задумался о том что они оба вообще делать должны только когда вообще написал этот llm и заглянул в логи, начав сравнивать результат работы regex и llm.')

  assert.equal(countAtoms(result, 'action', 'gesture'), 0)
})

test('keeps rp sigh as short gesture', async () => {
  const result = await run('*Я вздохнул*')

  assert.equal(countAtoms(result, 'action', 'gesture'), 1)
})

test('does not create dirty temporal duration from insulted mixed clause', async () => {
  const result = await run('Бляяя, Ху Тао, я еблан тот ещё. Я 4 дня.')

  assert.equal(
    result.atoms.some((item) => item.type === 'temporal' && item.subtype === 'duration' && item.text.includes('Бляяя')),
    false
  )
})

test('keeps clean temporal duration from short clause', async () => {
  const result = await run('Я 4 дня.')

  assert.equal(countAtoms(result, 'temporal', 'duration'), 1)
})

test('drops weak sigh rp when message also has plain semantic content', async () => {
  const result = await run('*Я вздохнул*\n\nПочинили наконец-то. Теперь сообщения снова работают.')

  assert.equal(countAtoms(result, 'action', 'gesture'), 0)
})

test('drops weak laugh rp when message also has plain semantic content', async () => {
  const result = await run('*Я рассмеялся*\n\nЕсли телеграм сломается, будем через консоль общаться.')

  assert.equal(countAtoms(result, 'action', 'gesture'), 0)
})

test('keeps standalone sigh rp as weak scene action for now', async () => {
  const result = await run('*Я вздохнул*')

  assert.equal(countAtoms(result, 'action', 'gesture'), 1)
})

test('does not create open loop from bridge question but knows continuation follows', async () => {
  const result = await run('Но знаешь что?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 0)
})

test('does not create open loop from very short rhetorical console question', async () => {
  const result = await run('Через консоль?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 0)
})

test('does not create open loop from short rhetorical honesty check', async () => {
  const result = await run('Честно?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 0)
})

test('keeps real short social question as open loop', async () => {
  const result = await run('Как ночка?')

  assert.equal(countAtoms(result, 'open_loop', 'direct_question'), 1)
})

test('does not promote conversational start summary into episode event', async () => {
  const result = await run('У меня, как видишь, началось оно с очередного обхода блокировки.')

  assert.equal(countAtoms(result, 'episode', 'event'), 0)
})

test('does not create preference need from operational logging chatter', async () => {
  const result = await run('Нужно немного поговорить для логов для начала.')

  assert.equal(countAtoms(result, 'preference', 'need'), 0)
})

test('does not create preference need from procedural evaluation wording', async () => {
  const result = await run('Пожалуйста, пройдите тест, нужно оценить ваши способности.')

  assert.equal(countAtoms(result, 'preference', 'need'), 0)
})

test('does not create temporal anchor now from operational current-step chatter', async () => {
  const result = await run('Видимо, сейчас пойдем в слои выше.')

  assert.equal(countAtoms(result, 'temporal', 'anchor_now'), 0)
})

test('does not create temporal anchor now from hedged now filler', async () => {
  const result = await run('Ты, мне кажется, переоценила сейчас эту мысль.')

  assert.equal(countAtoms(result, 'temporal', 'anchor_now'), 0)
})

test('does not create dislike preference from hypothetical boring fantasy', async () => {
  const result = await run('Представляю, как через месяц на экране будет написано "Мне скучно!"')

  assert.equal(countAtoms(result, 'preference', 'dislike'), 0)
})

test('keeps physical interaction from nose poke rp even in mixed message', async () => {
  const result = await run('Нужно немного поговорить.\n\n*Я легонько тыкнул тебя в кончик носа*')

  assert.equal(countAtoms(result, 'action', 'physical'), 1)
})

test('extracts physical touch from fingers on cheek rp', async () => {
  const result = await run('*Я легонько положил кончики пальцев тебе на щеку*')

  assert.equal(countAtoms(result, 'action', 'physical'), 1)
})

test('extracts physical action from started kissing rp', async () => {
  const result = await run('*Я навис над тобой и начал целовать тебя в щеки в разные места*')

  assert.equal(countAtoms(result, 'action', 'physical'), 1)
})

test('trims long mixed clause to real question core', async () => {
  const result = await run('Сейчас мы на этапе "Вообще понять, что идёт дождь из воды H2O", а потом уже будем прикручивать экстракторы, которые поймают нам и его запах, и реакцию, которое он вызвал, и ощущение капельки, которая попала тебе за шиворот. Слушай, а ты точно не сверхсилы какие-то?')

  const atom = findAtom(result, 'open_loop', 'direct_question')
  assert.ok(atom)
  assert.match(atom.text.toLowerCase(), /ты точно не сверхсилы какие-то\?$/)
})

test('does not keep long technical llm chatter as system entity', async () => {
  const result = await run('Мердж строить было бессмысленно, доделывать regex это бесконечное дело в русском языке, а llm превратилось в плохой промпт, поверх которого сел ещё один regex по сути.')

  assert.equal(countAtoms(result, 'entity', 'system'), 0)
})

test('splits long technical chatter into multiple plain clauses', async () => {
  const result = await extractRegexAtomsV1({
    event: {
      id: 'evt-tech-split',
      threadId: 'thread-test',
      platform: 'telegram',
      channel: 'text',
      role: 'user',
      world: 'Earth',
      timestamp: '2026-04-07T12:00:00.000Z',
      text: 'Мердж строить было бессмысленно, доделывать regex это бесконечное дело в русском языке, а llm превратилось в плохой промпт, поверх которого сел ещё один regex по сути. Зато regex экстрактор мы превратили в точечный отлов вопросов.',
      language: 'ru',
      replyToEventId: null,
      edited: false,
      attachments: [],
      meta: {}
    }
  })

  assert.ok(result.service.stats.clauseCount >= 3)
})

test('does not create anchor_now from technical current-state chatter', async () => {
  const result = await run('Ты все с тем же снапшотом, к сожалению сейчас.')

  assert.equal(countAtoms(result, 'temporal', 'anchor_now'), 0)
})