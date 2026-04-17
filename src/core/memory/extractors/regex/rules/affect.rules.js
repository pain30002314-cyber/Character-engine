'use strict'

const { runRuleList } = require('./shared/base.detector')
const { makeCandidate } = require('./shared/detector.utils')
const { toRoleRef } = require('../builders/atom.builder')

function actorRef(role) {
  return toRoleRef(role, 'я', 1)
}

function includesAny(text, variants) {
  return variants.some((variant) => text.includes(variant))
}

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:()"«»\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasSoftenedEmotionContext(text) {
  const source = normalizeForMatch(text)

  return includesAny(source, [
    'делает вид что',
    'делает вид, что',
    'будто',
    'словно',
    'как будто',
    'что то похожее на',
    'что-то похожее на',
    'не сердито',
    'не насмешливо',
    'почти'
  ])
}

function detectEmotion(text) {
  const source = normalizeForMatch(text)
  const softened = hasSoftenedEmotionContext(source)

  if (
    includesAny(source, [
      'мне страшно',
      'мне тревожно',
      'боюсь',
      'испуган',
      'испугана',
      'испугался',
      'испугалась',
      'тревожно',
      'тревога',
      'паника',
      'смотреть страшно'
    ])
  ) {
    return softened ? 'tension' : 'fear'
  }

  if (
    includesAny(source, [
      'мне грустно',
      'грустно',
      'грусть',
      'грустнее',
      'печально',
      'печаль',
      'тоскливо',
      'тоска',
      'в тоску',
      'тоску вгоняет',
      'расстроился',
      'расстроилась',
      'одиноко',
      'дистанция',
      'дистанцию',
      'дистанции',
      'пасмурное настроение',
      'настроение пасмурное',
      'мое настроение сейчас чуть пасмурное',
      'мое настроение',
      'мое настроение сейчас',
      'больно и грустно'
    ])
  ) {
    return 'sadness'
  }

  if (
    includesAny(source, [
      'злюсь',
      'разозлился',
      'разозлилась',
      'зло',
      'бесит',
      'мне обидно',
      'обидно',
      'обиделся',
      'обиделась'
    ])
  ) {
    return softened ? 'emotion' : 'anger'
  }

  if (
    includesAny(source, [
      'я рад',
      'я рада',
      'очень рад',
      'очень рада',
      'радостно',
      'обрадовался',
      'обрадовалась',
      'счастлив',
      'счастлива',
      'наслаждаюсь'
    ])
  ) {
    return 'joy'
  }

  if (
    includesAny(source, [
      'мне неловко',
      'неловко',
      'смущен',
      'смущена',
      'смутился',
      'стыдно',
      'стыд'
    ])
  ) {
    return 'embarrassment'
  }

  if (
    includesAny(source, [
      'устал',
      'устала',
      'подустал',
      'подустала',
      'вымотан',
      'вымотана',
      'измотан',
      'измотана',
      'устаю',
      'утомился',
      'утомилась',
      'мне тяжело',
      'мне и правда тяжело',
      'тяжело дается',
      'тяжело даётся',
      'тяжеловато',
      'работаю на максимум',
      'усталость'
    ])
  ) {
    return 'fatigue'
  }

  if (
    includesAny(source, [
      'напряжен',
      'напряжена',
      'напрягся',
      'напряглась',
      'нервно',
      'нервничаю',
      'нервничаешь',
      'переживаю',
      'переживаешь',
      'сомнения',
      'сосредоточен',
      'сосредоточена',
      'дистанция',
      'дистанцию',
      'дистанции'
    ])
  ) {
    return 'tension'
  }

  if (
    includesAny(source, [
      'это меня успокаивает',
      'успокаивает',
      'стало легче',
      'полегчало'
    ])
  ) {
    return 'relief'
  }

  return null
}

function polarityForEmotion(emotion) {
  if (['joy', 'relief'].includes(emotion)) return 'positive'
  if (['fear', 'sadness', 'anger', 'embarrassment', 'fatigue', 'tension'].includes(emotion)) return 'negative'
  return null
}

function isFalseAffect(text) {
  const lowered = normalizeForMatch(text)

  if (/мне\s+кажется/.test(lowered)) return true
  if (/обиделась[\s\S]*потом\s+извинил/.test(lowered)) return true
  if (/она\s+была\s+колючей/.test(lowered)) return true
  if (/^иногда\s*обжигает\s*иногда\s*согревает/.test(lowered)) return true
  if (/делает\s+вид\s+что\s+обиделась/.test(lowered)) return true

  if (/не\s+пережива(ешь|ет|ю|ем|ете)/.test(lowered)) return true
  if (/не\s+волну(ешься|ется|юсь|емся|етесь)/.test(lowered)) return true

  return false
}

function buildAffectCandidate({
  subtype,
  text,
  clause,
  context,
  rule,
  confidence,
  polarity
}) {
  const actor = actorRef(context.actorRole)

  return makeCandidate({
    type: 'affect',
    subtype,
    text,
    clause,
    context,
    source: {
      extractor: 'affect.regex',
      rule
    },
    actor,
    about: [actor],
    confidence,
    polarity,
    dedupeKeyHint: `affect::${subtype}::speaker::${text.toLowerCase()}`,
    payload: {
      emotion: subtype,
      valence: polarity
    }
  })
}

function ruleNameForEmotion(emotion) {
  return {
    affection: 'affection_v1',
    fear: 'fear_v1',
    sadness: 'sadness_v1',
    anger: 'anger_v1',
    joy: 'joy_v1',
    embarrassment: 'embarrassment_v1',
    fatigue: 'fatigue_v1',
    tension: 'tension_v1',
    relief: 'relief_v1'
  }[emotion] || 'affect_v1'
}

function detectOne({ clause, context }) {
  const text = clause.clauseText
  const unitText = clause.text || clause.clauseText || ''
  const results = []
  const normalizedUnit = normalizeForMatch(unitText)

  if (!text || isFalseAffect(unitText)) return results
  if (!normalizedUnit) return results

    if (
    normalizedUnit.length > 120 &&
    (
      normalizedUnit.includes('спасибо') ||
      normalizedUnit.includes('тепл') ||
      normalizedUnit.includes('щека') ||
      normalizedUnit.includes('рук') ||
      normalizedUnit.includes('поцелов')
    )
  ) {
    return results
  }

  const emotion = detectEmotion(unitText)
  if (!emotion) return results

  if (
    emotion === 'tension' &&
    /не\s+(пережива(ешь|ет|ю|ем|ете)|волну(ешься|ется|юсь|емся|етесь))/.test(normalizedUnit)
  ) {
    return results
  }

  results.push(
    buildAffectCandidate({
      subtype: emotion,
      text: unitText,
      clause,
      context,
      rule: ruleNameForEmotion(emotion),
      confidence:
        emotion === 'fear' ? 0.9 :
        emotion === 'sadness' ? 0.86 :
        emotion === 'fatigue' ? 0.84 :
        emotion === 'anger' ? 0.82 :
        emotion === 'embarrassment' ? 0.84 :
        emotion === 'tension' ? 0.8 :
        emotion === 'joy' ? 0.8 :
        0.78,
      polarity: polarityForEmotion(emotion)
    })
  )

  return results
}

async function detect({ clauses }) {
  return runRuleList({ clauses, detectOne })
}

module.exports = {
  detect
}
