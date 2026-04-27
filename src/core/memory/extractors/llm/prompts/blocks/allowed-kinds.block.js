'use strict'

const {
  getAllowedKindDescriptionsForPass
} = require('../../registries/kind.registry')

function renderAllowedKindsBlock(extractorKey) {
  const lines = [
    'Допустимые kind',
    '',
    'Ты должен извлекать только сигналы своего типа.',
    '',
    'Строгие правила:',
    '- Выбирай candidate.kind ТОЛЬКО из списка ниже.',
    '- Не придумывай новые kind.',
    '- Не добавляй уточнения к kind.',
    '- Не записывай тему события в kind.',
    '',
    'Критически важно:',
    '- Если сигнал относится к другому типу (эмоция, эпизод, план, отношение и т.д.) — НЕ создавай candidate.',
    '- Если ты сомневаешься, подходит ли сигнал — НЕ создавай candidate.',
    '',
    'Лучше вернуть пустой массив, чем извлечь сигнал не своего типа.',
    '',
    'Если ни один kind не подходит — верни {"candidates":[]}.',
    ''
  ]

  for (const item of getAllowedKindDescriptionsForPass(extractorKey)) {
    lines.push(`- ${item.kind} — ${item.description}`)
  }

  return lines.join('\n').trim()
}

module.exports = {
  renderAllowedKindsBlock
}
