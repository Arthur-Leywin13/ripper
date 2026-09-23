const express = require('express')
const cors = require('cors')
const path = require('path')

let pendingQrDataUrl = null
let pendingStatus = 'starting'
let pendingSessionId = null
let pendingStarted = false

function checkAccess(req, res, next) {
  const key = process.env.WEB_ACCESS_KEY

  if (!key) return next()

  if (
    req.query.key === key ||
    req.headers['x-access-key'] === key
  ) {
    return next()
  }

  return res.status(403).send('Accès refusé.')
}

async function spawnPendingSession() {
  const sessionManager =
    require('./sessionManager')

  pendingStatus = 'starting'
  pendingQrDataUrl = null
  pendingSessionId =
    `web-${Date.now()}`

  console.log(
    `[Web] Démarrage de ${pendingSessionId}...`
  )

  await sessionManager.startSession(
    pendingSessionId,
    {
      onQr: async (qrDataUrl) => {
        pendingQrDataUrl = qrDataUrl
        pendingStatus = 'waiting'

        console.log(
          `[Web] QR prêt pour ${pendingSessionId}`
        )
      },

      onOpen: async () => {
        pendingStatus = 'connected'
        pendingQrDataUrl = null

        console.log(
          `[Web] ${pendingSessionId} connecté.`
        )

        setTimeout(() => {
          spawnPendingSession().catch(
            (err) => {
              console.error(
                '[Web] Erreur nouveau QR:',
                err
              )
            }
          )
        }, 1500)
      },
    }
  )
}

async function start() {
  if (pendingStarted) return

  pendingStarted = true

  const app = express()

  app.use(cors())

  app.use(
    express.static(
      path.join(
        __dirname,
        '..',
        'public'
      )
    )
  )

  app.get(
    '/',
    checkAccess,
    (req, res) => {
      res.sendFile(
        path.join(
          __dirname,
          '..',
          'public',
          'index.html'
        )
      )
    }
  )

  app.get(
    '/api/qr',
    checkAccess,
    (req, res) => {
      res.json({
        status: pendingStatus,
        sessionId: pendingSessionId,
        qr: pendingQrDataUrl,
      })
    }
  )

  app.get(
    '/api/sessions',
    checkAccess,
    (req, res) => {
      const sessionManager =
        require('./sessionManager')

      const sessions =
        sessionManager
          .listSessions()
          .filter(
            (session) =>
              session.status ===
              'connected'
          )
          .map((session) => ({
            id: session.id,
            phone: session.phoneNumber,
          }))

      res.json(sessions)
    }
  )

  const port = Number(
    process.env.PORT || 3000
  )

  await new Promise((resolve) => {
    app.listen(port, () => {
      console.log(
        `🌐 Serveur web sur le port ${port}`
      )

      resolve()
    })
  })

  spawnPendingSession().catch((err) => {
    console.error(
      '[Web] Erreur session QR:',
      err
    )
  })
}

module.exports = {
  start,
}