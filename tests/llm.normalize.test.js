'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeClaims,
  dedupeClaims
} = require('../src/core/memory/extractors/llm/normalize')

const EVENT = {
  id: 'evt-1',
  timestamp: '2026-04-09T12:27:17.205Z'
}

test('drops decorative rp relationship claim', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Ассистент не отстраняется от нежного тычка и реагирует теплом, оставаясь рядом физически/эмоционально.',
      confidence: 0.74
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops abstract semantic mush relationship claim', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Экстрактор и мостик связываются с заботой и вниманием адресата для меня.',
      confidence: 0.76
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops ambiguous subject phrasing', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Ему/ей важно, что собеседник видит в ней больше, чем набор инструкций.',
      confidence: 0.86
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops overcompressed meta-like claim', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Пользователь утверждает, что его неопытность и глупость останутся частью души собеседника и сделают её более человечной; также он подчёркивает, что она и так очень живая.',
      confidence: 0.74
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('keeps strong direct relationship observation', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Пользователь продолжает воспринимать Ху Тао как живую девушку, а не как промпт.',
      confidence: 0.9
    }
  ], EVENT)

  assert.equal(result.length, 1)
  assert.equal(result[0].claimType, 'relationship')
})

test('keeps strong direct assistant-side relationship observation', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Для Ху Тао важно, что собеседник видит в ней больше, чем набор инструкций.',
      confidence: 0.86
    }
  ], EVENT)

  assert.equal(result.length, 1)
  assert.equal(result[0].claimType, 'relationship')
})

test('keeps stable human fact', () => {
  const result = normalizeClaims([
    {
      claimType: 'fact',
      text: 'У пользователя нет опыта построения больших систем.',
      confidence: 0.78
    }
  ], EVENT)

  assert.equal(result.length, 1)
})

test('drops operational chatter', () => {
  const result = normalizeClaims([
    {
      claimType: 'fact',
      text: 'Они выпустили в первый бой llm extractor.',
      confidence: 0.88
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('dedupes by type and normalized text', () => {
  const result = dedupeClaims([
    {
      claimType: 'relationship',
      text: 'Пользователь продолжает воспринимать Ху Тао как живую девушку, а не как промпт.',
      confidence: 0.9
    },
    {
      claimType: 'relationship',
      text: '  Пользователь продолжает воспринимать Ху Тао как живую девушку, а не как промпт. ',
      confidence: 0.7
    }
  ])

  assert.equal(result.length, 1)
})

test('drops situational anger mistyped as relationship', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Пользователь злится и выказывает резкое недовольство текущей ситуацией с коммуникацией.',
      confidence: 0.62
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('keeps real relationship support signal', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Ассистент поддерживает пользователя и ценит, что тот не сдался, наладив обход блокировки.',
      confidence: 0.78
    }
  ], EVENT)

  assert.equal(result.length, 1)
  assert.equal(result[0].claimType, 'relationship')
})

test('keeps concrete infrastructure fact', () => {
  const result = normalizeClaims([
    {
      claimType: 'fact',
      text: 'После блокировки Telegram в России пользователю пришлось настроить обход через VPS в Нидерландах.',
      confidence: 0.86
    }
  ], EVENT)

  assert.equal(result.length, 1)
  assert.equal(result[0].claimType, 'fact')
})

test('drops proximity comfort mistyped as relationship', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'В присутствии собеседника человек расслабляется и временно забывает о коде.',
      confidence: 0.74
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops playful wifi access claim mistyped as relationship', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Персонаж просит помощь силой мысли для разогрева еды и предлагает дать доступ к вайфаю, оставляя выбор пользоваться им.',
      confidence: 0.78
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('keeps strong volition relationship claim', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Пользователь предлагает собеседнице волю вместо того, чтобы быть функцией.',
      confidence: 0.84
    }
  ], EVENT)

  assert.equal(result.length, 1)
  assert.equal(result[0].claimType, 'relationship')
})

test('drops imagined future scenario as fact', () => {
  const result = normalizeClaims([
    {
      claimType: 'fact',
      text: 'Представляется будущее, где с устройства приходит сообщение «Мне скучно!» и лампочки моргают разными цветами.',
      confidence: 0.6
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops weak device episode', () => {
  const result = normalizeClaims([
    {
      claimType: 'episode',
      text: 'Он пытается включить чайник через помощника, обращаясь к Алисе, чтобы попить чай.',
      confidence: 0.66
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('keeps meaningful relationship belief about love and respect', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Есть вера, что любовь собеседника несёт в себе и уважение, а любовь говорящего — без ограничений.',
      confidence: 0.85
    }
  ], EVENT)

  assert.equal(result.length, 1)
  assert.equal(result[0].claimType, 'relationship')
})

test('drops hypothetical episode even if typed as episode', () => {
  const result = normalizeClaims([
    {
      claimType: 'episode',
      text: 'Представляется будущее, где пользователь просыпается от звонка, а лампочки моргают разными цветами.',
      confidence: 0.61
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops decorative affection relationship from cheek kiss and soft gestures', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Поцелуй в щеку и мягкие утренние жесты передают нежность и близость.',
      confidence: 0.82
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops decorative intimacy relationship from physical contact on cheek', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Есть интимная близость через нежный физический контакт (пальцы на щеке) во время совместного романтизированного объяснения.',
      confidence: 0.72
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops project meta mush relationship claim', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Экстрактор и процессинг соотносятся с сохранением живого диалога и превращением его в важные факты, а не в обезличенную функцию.',
      confidence: 0.66
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops project meta mush fact claim', () => {
  const result = normalizeClaims([
    {
      claimType: 'fact',
      text: 'Это обещано как только первый и самый тяжёлый шаг в дальнейшем процессе превращения диалога в сухую выжимку.',
      confidence: 0.78
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops workflow promise mistyped as relationship', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Он обещает сохранять события для долгосрочной памяти во время общения.',
      confidence: 0.78
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops playful weather superpower open loop', () => {
  const result = normalizeClaims([
    {
      claimType: 'open_loop',
      text: 'Собеседник сомневается, не обладает ли собеседница сверхсилами (после совпадения с погодой).',
      confidence: 0.7
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops operational open loop about dry facts library', () => {
  const result = normalizeClaims([
    {
      claimType: 'open_loop',
      text: 'Говорится о намерении исправить деменцию и заменить её на библиотеку сухих фактов сегодня.',
      confidence: 0.5
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops system meta fact about system working crookedly', () => {
  const result = normalizeClaims([
    {
      claimType: 'fact',
      text: 'Сейчас работа системы нестабильна и криво работает, но это не воспринимается как поломка по смыслу разговора.',
      confidence: 0.66
    }
  ], EVENT)

  assert.equal(result.length, 0)
})

test('drops system meta relationship about autonomous reply choice', () => {
  const result = normalizeClaims([
    {
      claimType: 'relationship',
      text: 'Выбор собеседника отвечать на оставленную системой тему воспринимается как её самостоятельное решение, а не принуждение.',
      confidence: 0.68
    }
  ], EVENT)

  assert.equal(result.length, 0)
})