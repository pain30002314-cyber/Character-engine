'use strict'

function renderCurrentMessageBlock(baseEventPacket) {
  const text = baseEventPacket?.event?.messageText || ''

  return [
    'Текущее сообщение',
    '"""',
    text || 'Сообщение пустое.',
    '"""'
  ].join('\n')
}

module.exports = {
  renderCurrentMessageBlock
}
