const { runRawExtraction } = require('../raw/raw-extraction.service')

async function runExtractPipeline({ threadId, event }) {
  const rawPacket = await runRawExtraction({
    threadId,
    event
  })

  return {
    rawPacket
  }
}

module.exports = {
  runExtractPipeline
}