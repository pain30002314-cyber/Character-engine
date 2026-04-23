'use strict'

function renderFastSignalsBlock(baseEventPacket) {
  const signals = Array.isArray(baseEventPacket?.fastSignals)
    ? baseEventPacket.fastSignals
    : []

  if (!signals.length) {
    return [
      'Быстрые сигналы',
      '- Явных быстрых сигналов не выделено.'
    ].join('\n')
  }

  return [
    'Быстрые сигналы',
    ...signals.map((item) => `- ${item}`)
  ].join('\n')
}

module.exports = {
  renderFastSignalsBlock
}
