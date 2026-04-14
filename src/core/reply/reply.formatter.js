function formatReply(rawReply) {
  const text = String(rawReply || '').trim()

  if (!text) {
    return 'Хм. Что-то у меня мысль споткнулась. Скажи ещё раз.'
  }

  return text
}

module.exports = {
  formatReply
}