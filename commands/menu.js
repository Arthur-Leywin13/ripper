const fs = require('fs')
const path = require('path')
const config = require('../config')

module.exports = {
  name: 'menu',
  aliases: ['help', 'commands'],
  description: 'Affiche le menu des commandes',
  async execute({ sock, jid, prefix }) {
    const videoPath = path.join(__dirname, '..', 'assets', 'menu.mp4')
    const posterPath = path.join(__dirname, '..', 'assets', 'img', 'menu-bg.jpg')

    const caption = `
╭─❑ *JACK THE RIPPER* ❑─╮
│ "Je ne chasse pas les victimes.
│  J'observe la beauté dans la chair."
╰────────────────╯

Sous la protection de *${config.OWNER_NAME}*.
Préfixe actuel: *${prefix}*

📥 *Ce que je peux récupérer pour vous*
${prefix}ytmp3 <lien youtube> — une mélodie
${prefix}ytmp4 <lien youtube> — une scène
${prefix}dl <lien> — depuis TikTok, Instagram, Facebook...

🌦️ *Ce que je peux vous révéler*
${prefix}weather <ville> — le ciel qu'il fera
${prefix}crypto <symbole> — le prix du sang numérique

💬 *Ce que je peux vous dire*
${prefix}ai <message> — me parler directement

🗡️ *Ce que je fais du désordre*
${prefix}kick @user
${prefix}ban @user
${prefix}kickall
${prefix}setprefix <caractère>
${prefix}status on|off — like automatique des statuts

👁️ *Ce qui devait rester caché*
${prefix}vv — révèle ce qu'on croyait éphémère

Londres, 1888. Certaines choses ne changent jamais.
`.trim()

    if (fs.existsSync(videoPath)) {
      await sock.sendMessage(jid, { video: fs.readFileSync(videoPath), caption, gifPlayback: false })
    } else if (fs.existsSync(posterPath)) {
      await sock.sendMessage(jid, { image: fs.readFileSync(posterPath), caption })
    } else {
      await sock.sendMessage(jid, { text: caption })
    }
  },
}
