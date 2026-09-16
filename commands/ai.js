const axios = require('axios')
const config = require('../config')
const persona = require('../lib/persona')
const SYSTEM_PROMPT = require('../lib/jackPersonaPrompt')

// Historique court en mémoire (perdu au redémarrage) — juste assez pour garder le fil d'une conversation
const history = new Map() // clé: sessionId:jid -> [{role, content}, ...]
const MAX_TURNS = 6

function historyKey(sessionId, jid) {
  return `${sessionId}:${jid}`
}

module.exports = {
  name: 'ai',
  aliases: ['jack'],
  description: 'Parle directement avec Jack',
  async execute({ sock, jid, args, sessionId }) {
    const question = args.join(' ')
    if (!question) {
      return sock.sendMessage(jid, { text: 'Dites quelque chose. Je ne réponds pas au silence.' })
    }
    if (!config.GROQ_API_KEY) {
      return sock.sendMessage(jid, { text: 'Je suis... indisponible pour l\'instant.' })
    }

    const key = historyKey(sessionId, jid)
    const past = history.get(key) || []

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...past,
      { role: 'user', content: question },
    ]

    try {
      const { data } = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        { model: config.GROQ_MODEL, messages, temperature: 0.8, max_tokens: 400 },
        { headers: { Authorization: `Bearer ${config.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
      )

      const reply = data.choices?.[0]?.message?.content?.trim()
      if (!reply) throw new Error('Réponse vide')

      const updated = [...past, { role: 'user', content: question }, { role: 'assistant', content: reply }].slice(-MAX_TURNS * 2)
      history.set(key, updated)

      await sock.sendMessage(jid, { text: reply })
    } catch (err) {
      await sock.sendMessage(jid, { text: persona.pick(persona.error) })
    }
  },
}
