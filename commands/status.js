const db = require('../lib/db')

module.exports = {
  name: 'status',
  aliases: ['autostatus'],
  description: 'Active/désactive le like automatique des statuts (avec emoji)',
  async execute({ sock, jid, args, isOwner, sessionId }) {
    if (!isOwner) {
      return sock.sendMessage(jid, { text: 'Ce privilège est réservé à peu de monde.' })
    }

    const choice = (args[0] || '').toLowerCase()
    if (choice !== 'on' && choice !== 'off') {
      const current = db.getAutoStatus(sessionId)
      return sock.sendMessage(jid, {
        text: `Usage: .status on | .status off\nActuellement: ${current ? 'activé 🟢' : 'désactivé 🔴'}`,
      })
    }

    db.setAutoStatus(sessionId, choice === 'on')
    await sock.sendMessage(jid, {
      text: choice === 'on'
        ? "Je vais observer les statuts, et laisser une marque à chacun."
        : "Je n'y toucherai plus.",
    })
  },
}
