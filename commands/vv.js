const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

module.exports = {
  name: 'vv',
  description: 'Télécharge une image, vidéo ou audio (y compris à vue unique)',

  async execute({ sock, jid, quotedMessage, msg }) {
    if (!quotedMessage) {
      return sock.sendMessage(jid, {
        text: 'Veuillez répondre à un média ou à un message à vue unique.'
      }, { quoted: msg })
    }

    // Décapsulage des conteneurs éphémères et à vue unique
    let inner = quotedMessage
    if (inner.ephemeralMessage) inner = inner.ephemeralMessage.message
    if (inner.viewOnceMessage) inner = inner.viewOnceMessage.message
    if (inner.viewOnceMessageV2) inner = inner.viewOnceMessageV2.message
    if (inner.viewOnceMessageV2Extension) inner = inner.viewOnceMessageV2Extension.message
    if (inner.documentWithCaptionMessage) inner = inner.documentWithCaptionMessage.message

    // Détection du média (Image, Vidéo ou Audio)
    const media = inner.imageMessage || inner.videoMessage || inner.audioMessage

    if (!media) {
      return sock.sendMessage(jid, {
        text: 'Le message visé ne contient aucun média compatible (image, vidéo, audio).'
      }, { quoted: msg })
    }

    // Détermination du type Baileys
    let type = 'image'
    if (inner.videoMessage) type = 'video'
    if (inner.audioMessage) type = 'audio'

    try {
      const stream = await downloadContentFromMessage(media, type)
      const buffer = await streamToBuffer(stream)

      const payload = { [type]: buffer }

      // Gestion de la légende s'il s'agit d'un média visuel
      if (media.caption) {
        payload.caption = media.caption
      }

      // Si c'est un vocal, préciser la distinction PTT/Audio
      if (type === 'audio') {
        payload.mimetype = media.mimetype || 'audio/mp4'
        payload.ptt = !!media.ptt
      }

      await sock.sendMessage(jid, payload, { quoted: msg })
    } catch (err) {
      console.error('[vv] Erreur de téléchargement:', err)
      await sock.sendMessage(jid, {
        text: 'Échec du téléchargement du média à vue unique.'
      }, { quoted: msg })
    }
  },
}