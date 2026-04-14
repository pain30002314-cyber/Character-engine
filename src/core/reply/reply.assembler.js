function buildListBlock(title, items, maxItems = 5) {
  if (!Array.isArray(items) || items.length === 0) return null

  const trimmed = items.slice(0, maxItems)
  return `${title}:\n- ${trimmed.join('\n- ')}`
}

function buildTemporalBlock(temporal) {
  if (!temporal) return null

  const parts = []

  if (temporal.messageCount) {
    parts.push(`Сообщений в треде: ${temporal.messageCount}`)
  }

  if (temporal.lastUserMessageAt) {
    parts.push(`Последнее сообщение пользователя: ${temporal.lastUserMessageAt}`)
  }

  if (temporal.lastAssistantMessageAt) {
    parts.push(`Последний ответ Ху Тао: ${temporal.lastAssistantMessageAt}`)
  }

  if (parts.length === 0) return null
  return `ВРЕМЯ:\n${parts.join('\n')}`
}

function buildMemorySystemBlock(snapshot) {
  if (!snapshot) return ''

  const blocks = []

  if (snapshot.summary) {
    blocks.push(`КРАТКАЯ ВЫЖИМКА:\n${snapshot.summary}`)
  }

  const factsBlock = buildListBlock('ВАЖНЫЕ ФАКТЫ', snapshot.recentFacts, 5)
  const entitiesBlock = buildListBlock('СУЩНОСТИ', snapshot.entities, 5)
  const loopsBlock = buildListBlock('ОТКРЫТЫЕ ТЕМЫ', snapshot.openLoops, 3)
  const relationBlock = buildListBlock('ЭМОЦИОНАЛЬНЫЙ СЛЕД', snapshot.relationshipSignals, 3)
  const episodeBlock = buildListBlock('ЯРКИЕ ЭПИЗОДЫ', snapshot.episodicMemories, 2)
  const temporalBlock = buildTemporalBlock(snapshot.temporal)

  for (const block of [
    factsBlock,
    entitiesBlock,
    loopsBlock,
    relationBlock,
    episodeBlock,
    temporalBlock
  ]) {
    if (block) blocks.push(block)
  }

  if (Array.isArray(snapshot.recentDialog) && snapshot.recentDialog.length > 0) {
    const dialogBlock = snapshot.recentDialog
      .slice(-6)
      .map((item) => `${item.role === 'assistant' ? 'Ху Тао' : 'Пользователь'}: ${item.text}`)
      .join('\n')

    blocks.push(`ПОСЛЕДНИЕ РЕПЛИКИ:\n${dialogBlock}`)
  }

  if (blocks.length === 0) return ''

  return [
    'Ниже внутренняя память разговора.',
    'Используй её для непрерывности.',
    '',
    'ВРЕМЕННАЯ ОПОРА',
    '',
    'Если в контексте переданы timestamp и временные метки, считай их текущей реальностью разговора.',
    'Опирайся на них при упоминании времени, давности или последовательности событий.',
    '',
    'Если точного времени в контексте нет, не добавляй лишнюю искусственную точность.',
    'В таких случаях говори естественно и приблизительно, если это уместно по тону разговора.',
    'Не подменяй временные данные из контекста своими версиями.',
    '',
    blocks.join('\n\n')
  ].join('\n')
}

function assembleReplyInput({ userMessage, snapshot }) {
  return {
    memoryContext: buildMemorySystemBlock(snapshot),
    userMessage: String(userMessage || '')
  }
}

module.exports = {
  assembleReplyInput
}