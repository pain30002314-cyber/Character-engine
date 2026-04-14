function createDefaultIdentityProfile(threadId) {
  return {
    threadId,
    coreUser: {
      coreId: 'core_user:main',
      displayName: null,
      handles: [],
      aliases: ['пользователь'],
      platformUserIds: [],
      usernames: [],
      identityConfidence: 0.3
    },
    coreCharacter: {
      coreId: 'core_character:hutao',
      canonicalName: 'Ху Тао',
      aliases: ['ху тао', 'хутао'],
      identityConfidence: 1
    },
    updatedAt: null
  }
}

module.exports = {
  createDefaultIdentityProfile
}