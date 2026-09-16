const express = require('express')
const cors = require('cors')
const path = require('path')
const QRCode = require('qrcode')

const sessionManager = require('./sessionManager')
const { maskPhone } = require('./maskPhone')

let pendingQrDataUrl = null
let pendingStatus = 'starting' // starting | waiting | connected
let pendingSessionId = null

async function spawnPendingSession() {
  pendingStatus = 'starting'
  pendingQrDataUrl = null
  pendingSessionId = `web-${Date.now()}`
  console.log(`[Web] Démarrage de la session ${pendingSessionId}...`)

  await sessionManager.startSession(pendingSessionId, {
    onQr: async (qr) => {
      try {
        console.log(`[Web] Callback onQr déclenché pour ${pendingSessionId}`)
        pendingQrDataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 1 })
        pendingStatus = 'waiting'
        console.log(`[Web] ✅ QR Data URL générée pour ${pendingSessionId}`)
      } catch (e) {
        console.error('[Web] Erreur génération QR:', e)
      }
    },
    onOpen: () => {
      console.log(`[Web] Session ${pendingSessionId} connectée`)
      pendingStatus = 'connected'
      pendingQrDataUrl = null
      // Une fois ce visiteur connecté, on ouvre immédiatement un nouveau QR
      // pour que la page reste utilisable pour la personne suivante.
      setTimeout(() => spawnPendingSession(), 1500)
    },
  })
}

function checkAccess(req, res, next) {
  const key = process.env.WEB_ACCESS_KEY
  if (!key) return next() // pas de protection configurée
  if (req.query.key === key || req.headers['x-access-key'] === key) return next()
  res.status(403).send('Accès refusé. Ajoute ?key=... à l\'URL.')
}

function start() {
  const app = express()
  app.use(cors())
  app.use(express.static(path.join(__dirname, '..', 'public')))

  app.get('/', checkAccess, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
  })

  app.get('/api/qr', checkAccess, (req, res) => {
    console.log(`[Web] GET /api/qr - status: ${pendingStatus}, has qr: ${!!pendingQrDataUrl}`)
    res.json({ status: pendingStatus, qr: pendingQrDataUrl })
  })

  app.get('/api/sessions', checkAccess, (req, res) => {
    const list = sessionManager
      .listSessions()
      .filter((s) => s.status === 'connected')
      .map((s) => ({ id: s.id, phone: maskPhone(s.phoneNumber) }))
    res.json(list)
  })

  const port = process.env.PORT || 3000
  app.listen(port, () => {
    console.log(`🌐 Page de connexion disponible sur le port ${port}`)
  })

  // 🔴 IMPORTANT: await la première génération du QR
  spawnPendingSession().catch((err) => {
    console.error('[Web] Erreur spawnPendingSession:', err)
  })
}

module.exports = { start }
