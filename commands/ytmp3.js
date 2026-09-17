const fs = require('fs')
const config = require('../config')
const persona = require('../lib/persona')
const {
  searchYouTube,
  getInfo,
  downloadAudio,
} = require('../lib/ytdlp')

module.exports = {
  name: 'ytmp3',
  aliases: ['play', 'music'],
  description: 'Recherche et télécharge une musique depuis YouTube',

  async execute({ sock, jid, args }) {
    const query = args.join(' ').trim()

    if (!query) {
      return sock.sendMessage(jid, {
        text: 'Donnez-moi le titre de la musique à rechercher.'
      })
    }

    await sock.sendMessage(jid, {
      text: persona.pick(persona.greetPatience)
    })

    let file = null

    try {
      let url = query

      // Si ce n'est pas un lien, recherche sur YouTube
      if (!/^https?:\/\//i.test(query)) {
        const result = await searchYouTube(query)
        url = result.url
      }

      // Vérification de la durée
      const info = await getInfo(url)

      if (
        info.duration &&
        info.duration > config.YTDL_MAX_DURATION_SECONDS
      ) {
        return sock.sendMessage(jid, {
          text: `Trop long pour mon goût — pas plus de ${config.YTDL_MAX_DURATION_SECONDS / 60} minutes.`,
        })
      }

      // Téléchargement
      const result = await downloadAudio(url)

      file = result.file

      const title = result.title || 'Musique'
      const artist = result.artist || 'Artiste inconnu'

      // Envoi direct du fichier audio
      await sock.sendMessage(jid, {
        audio: fs.readFileSync(file),
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
      })

      // Message avec titre + artiste
      await sock.sendMessage(jid, {
        text: `🎵 ${title}\n👤 ${artist}`
      })

      // Suppression du fichier temporaire
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }

      file = null

    } catch (err) {
      console.error('[YTMP3]', err)

      await sock.sendMessage(jid, {
        text: `${persona.pick(persona.error)}\n(${err.message})`
      })

      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    }
  },
}