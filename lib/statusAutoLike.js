const db = require('./db')

const LIKE_EMOJIS = ['❤️', '🔥', '😮', '👍', '💀', '✨', '😂', '🙌']

function pickEmoji() {
  return LIKE_EMOJIS[Math.floor(Math.random() * LIKE_EMOJIS.length)]
}

async function autoLikeStatus({ sock, sessionId, msg }) {
  if (!db.getAutoStatus(sessionId)) return

  const participant = msg.key.participant
  if (!participant) return

  try {
    await sock.sendMessage(
      'status@broadcast',
      { react: { text: pickEmoji(), key: msg.key } },
      { statusJidList: [participant] }
    )
  } catch (err) {
    console.error(`[${sessionId}] Erreur auto-like statut:`, err.message)
  }
}

module.exports = { autoLikeStatus }
