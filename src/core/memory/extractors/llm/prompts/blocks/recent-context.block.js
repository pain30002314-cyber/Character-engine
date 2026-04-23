'use strict'

function renderRecentContextBlock(baseEventPacket) {
  const items = Array.isArray(baseEventPacket?.recentContext)
    ? baseEventPacket.recentContext
    : []

  if (!items.length) {
    return [
      'Недавний контекст',
      '- Недавний контекст отсутствует.'
    ].join('\n')
  }

  return [
    'Недавний контекст',
    ...items.map(
      (item, index) =>
        `${index + 1}. ${item.speakerRoleLabel || 'Собеседник'}${item.speakerName ? ` ${item.speakerName}` : ''}: ${item.text}`
    )
  ].join('\n')
}

module.exports = {
  renderRecentContextBlock
}
