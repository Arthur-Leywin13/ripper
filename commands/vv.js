const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

module.exports = {
  name: 'vv',
  description: 'Télécharge une image ou vidéo (y compris en vue unique)',

  async execute({ sock, jid, quotedMessage }) {
    if (!quotedMessage) {
      return sock.sendMessage(jid, {
        text: 'Répondez à une image ou une vidéo (normale ou vue unique).'
      })
    }

    // Extraction du message interne si c'est un message en vue unique (v1 ou v2)
    const innerMessage = 
      quotedMessage.viewOnceMessage?.message ||
      quotedMessage.viewOnceMessageV2?.message ||
      quotedMessage.viewOnceMessageV2Extension?.message ||
      quotedMessage

    const media =
      innerMessage.imageMessage ||
      innerMessage.videoMessage

    if (!media) {
      return sock.sendMessage(jid, {
        text: 'Le message ciblé ne contient pas d\'image ou de vidéo.'
      })
    }

    const type = innerMessage.imageMessage ? 'image' : 'video'

    try {
      const stream = await downloadContentFromMessage(media, type)
      const buffer = await streamToBuffer(stream)

      const payload = { [type]: buffer }

      if (media.caption) {
        payload.caption = media.caption
      }

      await sock.sendMessage(jid, payload)
    } catch (err) {
      console.error('[vv] Erreur téléchargement:', err)
      await sock.sendMessage(jid, {
        text: 'Impossible de récupérer ce média.'
      })
    }
  },
}
