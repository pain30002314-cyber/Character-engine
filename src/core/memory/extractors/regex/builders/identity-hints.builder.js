'use strict'

const { buildHintId } = require('../core/ids')

function buildIdentityHints(candidates, event) {
  const hints = []

  for (const item of candidates || []) {
    if (item.type !== 'identity') continue
    if (!['display_name', 'role'].includes(item.subtype)) continue

    const value =
      item.payload?.value ||
      item.payload?.normalizedValue ||
      item.text

    if (!value) continue

    hints.push({
      id: buildHintId('identity', event.id, value),
      kind: item.subtype === 'display_name' ? 'display_name_candidate' : 'core_role_hint',
      value,
      normalizedValue: String(value).toLowerCase(),
      confidence: item.confidence || 0.8,
      sourceEventId: event.id,
      timestamp: event.timestamp,
      source: item.source,
      payload: {
        forRole: item.actor?.role === 'user' ? 'core_user' : 'assistant',
        evidenceType: 'regex_identity_signal',
        linkedAtomIds: [item.id]
      }
    })
  }

  return hints
}

module.exports = {
  buildIdentityHints
}