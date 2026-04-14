const env = require('../../config/env')
const { generateReply } = require('../../services/llm.service')
const { assembleReplyInput } = require('./reply.assembler')
const { formatReply } = require('./reply.formatter')

async function generateCharacterReply({ userMessage, snapshot }) {
  const payload = assembleReplyInput({
    userMessage,
    snapshot
  })

  const rawReply = await generateReply({
    ...payload,
    model: env.model
  })

  return formatReply(rawReply)
}

module.exports = {
  generateCharacterReply
}