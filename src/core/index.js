const { normalizeInputMessage } = require('../shared/message.types')
const { generateCharacterReply } = require('./reply/reply.service')
const {
  recordUserMessage,
  getMemorySnapshot
} = require('./memory/memory.service')

async function handleInput(rawInput) {
  const input = normalizeInputMessage(rawInput)

  await recordUserMessage({
    threadId: input.threadId,
    text: input.text,
    platform: input.platform,
    channel: input.channel,
    world: input.world,
    chatId: input.chatId,
    userId: input.userId,
    username: input.username
  })

  const snapshot = await getMemorySnapshot(input.threadId)

  const reply = await generateCharacterReply({
    userMessage: input.text,
    snapshot
  })

  return {
    reply
  }
}

module.exports = {
  handleInput
}