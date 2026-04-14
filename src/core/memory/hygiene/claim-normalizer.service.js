function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripOuterPunctuation(value) {
  return String(value || '')
    .trim()
    .replace(/^[\s"'`“”‘’.,!?;:()\-—]+/, '')
    .replace(/[\s"'`“”‘’.,!?;:()\-—]+$/, '')
    .trim()
}

function normalizeSentence(value) {
  const text = stripOuterPunctuation(normalizeWhitespace(value))
  if (!text) return ''

  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
}

function toSlug(value, maxLen = 80) {
  return normalizeSentence(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen)
}

function looksLikeQuestion(text) {
  return /\?\s*$/.test(String(text || '').trim())
}

function removeOpenLoopLeadIn(text) {
  let result = normalizeSentence(text)

  const patterns = [
    /^пользователь\s+(спрашивает|просит)\s*,?\s*/i,
    /^остается?\s+открытым\s+вопрос\s+о\s+том\s*,?\s+что\s+/i,
    /^остается?\s+открытым\s+вопрос\s+о\s+том\s*,?\s*/i,
    /^открытый\s+вопрос\s*:\s*/i,
    /^вопрос\s*:\s*/i,
    /^тема\s+/i
  ]

  for (const pattern of patterns) {
    result = result.replace(pattern, '')
  }

  return normalizeSentence(result)
}

function normalizeOpenLoopText(text) {
  let result = removeOpenLoopLeadIn(text)

  result = result
    .replace(/^видит\s+ли\s+ху\s+тао\s+/i, 'Ху Тао видит ')
    .replace(/^может\s+ли\s+ху\s+тао\s+/i, 'Ху Тао может ')
    .replace(/^что\s+ху\s+тао\s+видит\s+/i, 'Что Ху Тао видит ')
    .replace(/^что\s+она\s+видит\s+/i, 'Что Ху Тао видит ')
    .replace(/^описать\s+что\s+ты\s+видишь\s+/i, 'Что Ху Тао видит ')
    .replace(/^видишь\s+дату\s+и\s+время/i, 'Ху Тао видит дату и время')
    .replace(
      /^и\s+в\s+целом\s+можешь\s*,?\s*пожал(?:й|у)ста\s*,?\s*описать\s+что\s+ты\s+видишь\s+в\s+этой\s+библиотеке\s+помимо\s+себя\s+самой/i,
      'Что Ху Тао видит в библиотеке помимо себя самой'
    )

  return normalizeSentence(result)
}

function classifyFactKind(text) {
  const source = normalizeSentence(text).toLowerCase()

  const imagerySignals = [
    'как будто',
    'словно',
    'похоже на',
    'ощущает',
    'чувствует',
    'эхо',
    'тишина',
    'библиотек',
    'скрипят полки',
    'точка с запятой',
    'многоточие',
    'гул',
    'свет',
    'окно',
    'зал',
    'комната'
  ]

  const structuralSignals = [
    'находится',
    'происходит',
    'проводятся тесты',
    'через telegram',
    'через телеграм',
    'не помнит',
    'спит в тейвате',
    'в цифровом пространстве',
    'в цифровой форме',
    'между мирами',
    'память',
    'восстановления памяти',
    'пользователь',
    'андрей',
    'ху тао'
  ]

  const imageryHits = imagerySignals.filter((item) => source.includes(item)).length
  const structuralHits = structuralSignals.filter((item) => source.includes(item)).length

  if (imageryHits > structuralHits) {
    return 'imagery'
  }

  return 'structural'
}

function buildOpenLoopSemanticKey(text) {
  const source = normalizeOpenLoopText(text).toLowerCase()

  if (source.includes('дату и время')) {
    return 'hutao_sees_date_time'
  }

  if (source.includes('библиотек') && source.includes('помимо себя')) {
    return 'hutao_sees_library_beyond_self'
  }

  if (source.includes('природ') && source.includes('памят')) {
    return 'nature_of_memory_and_self'
  }

  if (source.includes('восстановлен') && source.includes('памят')) {
    return 'memory_restoration_testing'
  }

  if (source.includes('не помнит') && source.includes('андрей')) {
    return 'hutao_does_not_remember_andrey'
  }

  return toSlug(source, 64) || 'open_loop_topic'
}

function buildFactSemanticKey(text) {
  const source = normalizeSentence(text).toLowerCase()

  if (source.includes('цифровом пространстве') && source.includes('сервер')) {
    return 'hutao_consciousness_digital_server'
  }

  if (source.includes('тело') && source.includes('тейват')) {
    return 'hutao_body_sleeping_teyvat'
  }

  if (source.includes('telegram') || source.includes('телеграм')) {
    return 'communication_via_telegram'
  }

  if (source.includes('восстановлен') && source.includes('памят')) {
    return 'memory_restoration_tests'
  }

  if (source.includes('не помнит') && source.includes('андрей')) {
    return 'hutao_memory_gap_andrey'
  }

  if (source.includes('цифров') && source.includes('мостик')) {
    return 'digital_bridge_between_worlds'
  }

  return toSlug(source, 64) || 'fact_general'
}

function buildEpisodeSemanticKey(text) {
  return toSlug(normalizeSentence(text), 64) || 'episode_general'
}

function normalizeClaim(claim) {
  if (!claim || !claim.claimType) {
    return null
  }

  const text = normalizeSentence(claim.text)
  if (!text) {
    return null
  }

  const payload =
    claim.payload && typeof claim.payload === 'object'
      ? { ...claim.payload }
      : {}

  const normalized = {
    ...claim,
    text,
    payload
  }

  switch (claim.claimType) {
    case 'open_loop': {
      const normalizedText = normalizeOpenLoopText(text)

      normalized.text = normalizedText
      normalized.payload.normalizedText = normalizedText
      normalized.payload.semanticKey = buildOpenLoopSemanticKey(normalizedText)
      normalized.payload.semanticClass = looksLikeQuestion(text)
        ? 'question'
        : 'topic'
      break
    }

    case 'fact': {
      const kind = classifyFactKind(text)

      normalized.payload.normalizedText = text
      normalized.payload.semanticKey = buildFactSemanticKey(text)
      normalized.payload.semanticClass = kind

      if (kind === 'imagery') {
        normalized.claimType = 'episode'
        normalized.payload.reroutedFrom = 'fact'
        normalized.payload.importance = Math.max(
          Number(normalized.payload.importance || 0),
          55
        )
      }

      break
    }

    case 'episode': {
      normalized.payload.normalizedText = text
      normalized.payload.semanticKey = buildEpisodeSemanticKey(text)
      normalized.payload.semanticClass = 'episode'
      break
    }

    case 'relationship': {
      normalized.payload.normalizedText = text
      normalized.payload.semanticKey = toSlug(text, 64) || 'relationship_signal'
      normalized.payload.semanticClass = 'relationship'
      break
    }

    case 'entity': {
      normalized.text = stripOuterPunctuation(text)
      normalized.payload.normalizedText = normalized.text
      normalized.payload.semanticKey = toSlug(normalized.text, 64) || 'entity_named'
      normalized.payload.semanticClass = 'entity'
      break
    }

    default:
      break
  }

  return normalized
}

function normalizeClaims(claims) {
  return (claims || []).map(normalizeClaim).filter(Boolean)
}

module.exports = {
  normalizeClaims,
  normalizeClaim,
  normalizeOpenLoopText,
  buildOpenLoopSemanticKey,
  buildFactSemanticKey
}