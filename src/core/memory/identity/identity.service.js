const { createDefaultIdentityProfile } = require('./identity.store')

function uniquePush(list, value) {
  if (!value) return list
  if (!list.includes(value)) {
    list.push(value)
  }
  return list
}

function detectExplicitUserName(text) {
  const source = String(text || '')

  const patterns = [
    /\bменя зовут\s+([А-ЯЁ][а-яё]+)\b/,
    /\bя\s+[—-]\s*([А-ЯЁ][а-яё]+)\b/,
    /\bты\s+[—-]\s*([А-ЯЁ][а-яё]+)\b/
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  if (/\bандрей\b/i.test(source)) {
    return 'Андрей'
  }

  return null
}

function updateIdentityProfileFromEvent(identityProfile, event) {
  const next = identityProfile
    ? JSON.parse(JSON.stringify(identityProfile))
    : createDefaultIdentityProfile(event?.threadId || '')

  const username = event?.meta?.username || null
  const userId = event?.meta?.userId != null ? String(event.meta.userId) : null
  const explicitName = detectExplicitUserName(event?.text)

  if (username) {
    uniquePush(next.coreUser.handles, username)
    uniquePush(next.coreUser.usernames, username)
  }

  if (userId) {
    uniquePush(next.coreUser.platformUserIds, userId)
  }

  if (explicitName) {
    next.coreUser.displayName = explicitName
    uniquePush(next.coreUser.aliases, explicitName.toLowerCase())
    next.coreUser.identityConfidence = Math.max(next.coreUser.identityConfidence, 0.85)
  } else if (username) {
    next.coreUser.identityConfidence = Math.max(next.coreUser.identityConfidence, 0.45)
  }

  next.updatedAt = new Date().toISOString()
  return next
}

function getCoreRefs(identityProfile) {
  const profile = identityProfile || createDefaultIdentityProfile('')

  return {
    coreUserRef: profile.coreUser.coreId,
    coreCharacterRef: profile.coreCharacter.coreId
  }
}

module.exports = {
  updateIdentityProfileFromEvent,
  getCoreRefs
}