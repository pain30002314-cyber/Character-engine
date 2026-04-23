'use strict'

function renderEventMetaBlock(baseEventPacket) {
  const event = baseEventPacket?.event || {}
  const localizedTime = event.localizedTime || {}

  return [
    'Метаданные события',
    `- Дата: ${localizedTime.date || 'не указана'}`,
    `- Год: ${localizedTime.year || 'не указан'}`,
    `- Месяц: ${localizedTime.month || 'не указан'}`,
    `- Время: ${localizedTime.time || 'не указано'}${localizedTime.utcLabel ? ` (${localizedTime.utcLabel})` : ''}`,
    `- Платформа: ${event.platform || 'не указана'}`,
    `- Канал: ${event.channel || 'не указан'}`,
    `- Роль автора: ${event.speakerRole || 'не указана'}`,
    `- Имя автора: ${event.speakerName || 'не указано'}`,
    `- Язык промпта: ${baseEventPacket?.promptLanguage || 'русский'}`
  ].join('\n')
}

module.exports = {
  renderEventMetaBlock
}
