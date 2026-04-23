'use strict'

function renderBulletList(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join('\n')
}

function renderRoleBlock(roleDefinition) {
  const role = roleDefinition && typeof roleDefinition === 'object' ? roleDefinition : {}

  return [
    'Роль',
    role.identity || 'Ты проход широкого извлечения значимых для памяти сигналов.',
    '',
    'Что искать:',
    renderBulletList(role.find),
    '',
    'Что не делать:',
    renderBulletList(role.avoid)
  ]
    .filter((line, index, list) => {
      if (line !== '') return true
      return list[index - 1] !== ''
    })
    .join('\n')
    .trim()
}

module.exports = {
  renderRoleBlock
}
