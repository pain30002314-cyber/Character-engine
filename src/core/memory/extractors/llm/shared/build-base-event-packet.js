'use strict'

const { PROMPT_CONFIG } = require('../config/prompt.config')

const MONTH_NAMES = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря'
]

const MONTH_NAMES_NOMINATIVE = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь'
]

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function trimText(value, maxLength) {
  const text = normalizeText(value)

  if (!maxLength || text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength).trim()}...`
}

function toUtcPlus7DateParts(timestampIso) {
  if (!timestampIso) {
    return {
      date: null,
      year: null,
      month: null,
      time: null,
      utcLabel: PROMPT_CONFIG.promptUtcOffsetLabel
    }
  }

  const sourceDate = new Date(timestampIso)
  if (Number.isNaN(sourceDate.getTime())) {
    return {
      date: null,
      year: null,
      month: null,
      time: null,
      utcLabel: PROMPT_CONFIG.promptUtcOffsetLabel
    }
  }

  const shifted = new Date(sourceDate.getTime() + 7 * 60 * 60 * 1000)
  const year = String(shifted.getUTCFullYear())
  const monthIndex = shifted.getUTCMonth()
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  const hours = String(shifted.getUTCHours()).padStart(2, '0')
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0')

  return {
    date: `${Number(day)} ${MONTH_NAMES[monthIndex]} ${year}`,
    year,
    month: MONTH_NAMES_NOMINATIVE[monthIndex],
    time: `${hours}:${minutes}`,
    utcLabel: PROMPT_CONFIG.promptUtcOffsetLabel
  }
}

function localizePlatform(value) {
  const normalized = String(value || '').trim().toLowerCase()

  switch (normalized) {
    case 'telegram':
      return 'телеграм'
    case 'discord':
      return 'дискорд'
    case 'web':
      return 'веб'
    case 'unknown':
      return 'не указана'
    default:
      return normalized || 'не указана'
  }
}

function localizeChannel(value) {
  const normalized = String(value || '').trim().toLowerCase()

  switch (normalized) {
    case 'text':
      return 'текст'
    case 'voice':
      return 'голос'
    case 'dm':
      return 'личный канал'
    case 'group':
      return 'группа'
    default:
      return normalized || 'не указан'
  }
}

function resolveSpeakerRole(event) {
  const role = String(event?.role || '').trim().toLowerCase()

  if (role === 'assistant') {
    return 'персонаж'
  }

  if (role === 'system') {
    return 'система'
  }

  return 'пользователь'
}

function resolveSpeakerName(event, context = {}) {
  const identity = context?.identity || {}
  const meta = event?.meta || {}
  const role = String(event?.role || '').trim().toLowerCase()

  if (role === 'assistant') {
    return (
      identity.characterDisplayName ||
      meta.characterName ||
      meta.speakerName ||
      'персонаж'
    )
  }

  if (role === 'system') {
    return meta.speakerName || 'система'
  }

  return (
    identity.userDisplayName ||
    meta.displayName ||
    meta.firstName ||
    meta.username ||
    meta.speakerName ||
    'пользователь'
  )
}

function resolveContextSpeaker(item) {
  const role = String(item?.role || '').trim().toLowerCase()

  if (role === 'assistant') {
    return {
      speakerRole: 'assistant',
      speakerRoleLabel: 'Персонаж',
      speakerName: null
    }
  }

  if (role === 'system') {
    return {
      speakerRole: 'system',
      speakerRoleLabel: 'Система',
      speakerName: null
    }
  }

  return {
    speakerRole: 'user',
    speakerRoleLabel: 'Пользователь',
    speakerName: null
  }
}

function buildRecentContext(eventWindow = []) {
  return safeArray(eventWindow)
    .slice(-PROMPT_CONFIG.recentContextItems)
    .map((item) => ({
      ...resolveContextSpeaker(item),
      text: trimText(item?.text, PROMPT_CONFIG.recentContextCharsPerItem)
    }))
    .filter((item) => item.text)
}

function pushSignal(target, value) {
  if (!value) return
  if (!target.includes(value)) {
    target.push(value)
  }
}

function buildHeuristicFastSignals(event, recentContext = []) {
  const text = normalizeText(event?.text)
  const lower = text.toLowerCase()
  const signals = []

  if (!text) {
    return signals
  }

  if (/\bты\b|\bтеб[яе]\b|\bтвой\b|\bвам\b|\bвы\b/u.test(lower)) {
    pushSignal(signals, 'есть прямое обращение к собеседнику')
  }

  if (/\?/.test(text)) {
    pushSignal(signals, 'есть вопрос или незавершённый запрос')
  }

  if (/(сначала|потом|дальше|теперь|уже|пока|затем|продолжаем|следующий этап|перешли|закончил|закончила)/u.test(lower)) {
    pushSignal(signals, 'есть маркеры фазы или перехода')
  }

  if (/(рад|рада|тревож|груст|обид|злюсь|злость|боюсь|страшно|тепло|больно|важно|значимо|смущ|люблю|ненавижу|устал|устала)/u.test(lower)) {
    pushSignal(signals, 'есть эмоциональные или значимые маркеры')
  }

  if (/(давай|вместе|помоги|поможешь|проверь|сделай|посмотри|продолжим|нужно|надо|можешь|сможешь)/u.test(lower)) {
    pushSignal(signals, 'есть сигналы совместного действия или координации')
  }

  if (/(понял|поняла|осознал|осознала|вспомнил|вспомнила|заметил|заметила|оказалось|теперь ясно|выяснил|выяснила|переосмысл)/u.test(lower)) {
    pushSignal(signals, 'есть признаки осознания или переоценки')
  }

  if (/(потом|позже|вернусь|жду|осталось|не закончил|не закончила|нужно будет|надо будет)/u.test(lower)) {
    pushSignal(signals, 'есть признаки незавершённости или подвешенного продолжения')
  }

  if (recentContext.length > 0) {
    pushSignal(signals, 'есть недавний контекст для локальной интерпретации')
  }

  return signals.slice(0, PROMPT_CONFIG.fastSignalsLimit)
}

function buildFastSignals(event, context = {}, recentContext = []) {
  const provided = safeArray(context?.fastSignals)
    .map((item) => normalizeText(item))
    .filter(Boolean)

  const heuristic = buildHeuristicFastSignals(event, recentContext)
  const combined = []

  for (const item of provided) {
    pushSignal(combined, item)
  }

  for (const item of heuristic) {
    pushSignal(combined, item)
  }

  return combined.slice(0, PROMPT_CONFIG.fastSignalsLimit)
}

function buildBaseEventPacket({
  pass,
  event,
  eventWindow = [],
  context = {}
}) {
  const localizedTime = toUtcPlus7DateParts(event?.timestamp || null)
  const recentContext = buildRecentContext(eventWindow)

  return {
    promptVersion: PROMPT_CONFIG.version,
    promptLanguage: PROMPT_CONFIG.promptLanguage,
    promptLanguageCode: PROMPT_CONFIG.promptLanguageCode,
    extractor: {
      extractorKey: pass?.extractorKey || null,
      extractorName: pass?.extractorName || null,
      extractorRole: pass?.role || null
    },
    event: {
      timestampIso: event?.timestamp || null,
      localizedTime,
      platform: localizePlatform(event?.platform),
      channel: localizeChannel(event?.channel),
      speakerRole: resolveSpeakerRole(event),
      speakerName: resolveSpeakerName(event, context),
      messageText: trimText(event?.text, PROMPT_CONFIG.currentMessageChars)
    },
    recentContext,
    fastSignals: buildFastSignals(event, context, recentContext)
  }
}

module.exports = {
  buildBaseEventPacket
}
