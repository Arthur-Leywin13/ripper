const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys')

const { Boom } = require('@hapi/boom')
const qrcodeTerminal = require('qrcode-terminal')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')

const config = require('../config')
const { handleMessage } = require('./messageHandler')
const { updateQRCode } = require('./webServer')

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions')

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

// sessionId -> { sock, status }
const sessions = new Map()

function authPath(sessionId) {
  return path.join(SESSIONS_DIR, sessionId, 'auth_info')
}

function listExistingSessionIds() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return []
  }

  return fs.readdirSync(SESSIONS_DIR).filter((name) =>
    fs.existsSync(path.join(SESSIONS_DIR, name, 'auth_info'))
  )
}

/**
 * Démarre une session WhatsApp.
 *
 * @param {string} sessionId
 * @param {object} opts
 * @param {string} [opts.pairNumber]
 * @param {{sock, jid}} [opts.notifyTarget]
 */
async function startSession(sessionId, opts = {}) {
  const { pairNumber, notifyTarget } = opts

  const { state, saveCreds } = await useMultiFileAuthState(
    authPath(sessionId)
  )

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  })

  sessions.set(sessionId, {
    sock,
    status: 'connecting',
  })

  // Code de pairing si demandé
  if (pairNumber && !sock.authState.creds.registered) {
    try {
      const code = await sock.requestPairingCode(
        pairNumber.replace(/[^0-9]/g, '')
      )

      const text =
        `Code de pairing pour *${sessionId}*: \`${code}\`\n\n` +
        `WhatsApp -> Appareils connectés -> ` +
        `Lier un appareil -> Lier avec le numéro de téléphone -> ` +
        `entre ce code.`

      if (notifyTarget) {
        await notifyTarget.sock.sendMessage(
          notifyTarget.jid,
          { text }
        )
      } else {
        console.log(text)
      }
    } catch (err) {
      const errText =
        `Impossible de générer le code de pairing pour ` +
        `${sessionId}: ${err.message}`

      if (notifyTarget) {
        await notifyTarget.sock.sendMessage(
          notifyTarget.jid,
          { text: errText }
        )
      } else {
        console.error(errText)
      }
    }
  }

  // Sauvegarde des identifiants WhatsApp
  sock.ev.on('creds.update', saveCreds)

  // Gestion de la connexion
  sock.ev.on('connection.update', async (update) => {
    const {
      connection,
      lastDisconnect,
      qr,
    } = update

    // Nouveau QR reçu
    if (qr && !pairNumber) {
      try {
        // Génère une Data URL PNG pour l'interface web
        const qrDataUrl = await QRCode.toDataURL(qr, {
          type: 'image/png',
          width: 300,
          margin: 2,
        })

        updateQRCode(sessionId, qrDataUrl)

        console.log(
          `[${sessionId}] Nouveau QR généré pour l'interface web.`
        )
      } catch (e) {
        console.error(
          'Erreur génération QR data URL:',
          e
        )
      }

      // Si une session connectée doit recevoir le QR
      if (notifyTarget) {
        try {
          const png = await QRCode.toBuffer(qr, {
            type: 'png',
            width: 512,
          })

          await notifyTarget.sock.sendMessage(
            notifyTarget.jid,
            {
              image: png,
              caption:
                `QR pour la session *${sessionId}*.` +
                ` Scanne-le dans les ~45 secondes.`,
            }
          )
        } catch (e) {
          console.error(
            'Erreur envoi QR image:',
            e
          )
        }
      } else {
        // Affichage également dans les logs Railway
        console.log(
          `\n--- QR pour la session "${sessionId}" ` +
          `(scanne dans les logs ou via un lecteur QR ASCII) ---`
        )

        qrcodeTerminal.generate(qr, {
          small: true,
        })
      }
    }

    // Connexion fermée
    if (connection === 'close') {
      const statusCode =
        new Boom(lastDisconnect?.error)
          ?.output?.statusCode

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut

      const session = sessions.get(sessionId)

      if (session) {
        session.status = 'disconnected'
      }

      console.log(
        `[${sessionId}] Connexion fermée.`,
        shouldReconnect
          ? 'Reconnexion...'
          : 'Déconnecté (session retirée).'
      )

      if (shouldReconnect) {
        startSession(sessionId, opts).catch((err) => {
          console.error(
            `[${sessionId}] Erreur reconnexion:`,
            err
          )
        })
      } else {
        sessions.delete(sessionId)
      }
    }

    // Connexion réussie
    else if (connection === 'open') {
      const session = sessions.get(sessionId)

      if (session) {
        session.status = 'connected'
      }

      console.log(
        `✅ [${sessionId}] ${config.BOT_NAME} connecté.`
      )

      if (notifyTarget) {
        await notifyTarget.sock.sendMessage(
          notifyTarget.jid,
          {
            text:
              `Session *${sessionId}* connectée.`,
          }
        )
      }
    }
  })

  // Réception des messages
  sock.ev.on(
    'messages.upsert',
    async ({ messages }) => {
      const msg = messages[0]

      if (!msg) {
        return
      }

      try {
        await handleMessage({
          sock,
          sessionId,
          sessionManager: module.exports,
          msg,
        })
      } catch (err) {
        console.error(
          `[${sessionId}] Erreur handleMessage:`,
          err
        )
      }
    }
  )

  return sock
}

/**
 * Démarre toutes les sessions.
 */
async function bootAll() {
  // Démarre le serveur web
  const { startServer } = require('./webServer')

  await startServer(
    process.env.PORT || 3000
  )

  // Sessions déjà authentifiées
  const existing =
    listExistingSessionIds()

  // Sessions déclarées dans SESSION_IDS
  const declared =
    (process.env.SESSION_IDS || 'main')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

  const toStart =
    new Set([
      ...existing,
      ...declared,
    ])

  for (const id of toStart) {
    try {
      await startSession(id)
    } catch (err) {
      console.error(
        `[${id}] Impossible de démarrer la session:`,
        err
      )
    }
  }
}

/**
 * Récupère une session.
 */
function getSession(sessionId) {
  return sessions.get(sessionId)
}

/**
 * Liste les sessions et leur statut.
 */
function listSessions() {
  return Array.from(
    sessions.entries()
  ).map(([id, session]) => ({
    id,
    status: session.status,
  }))
}

/**
 * Supprime une session.
 */
async function deleteSession(sessionId) {
  const session =
    sessions.get(sessionId)

  if (session) {
    try {
      await session.sock.logout()
    } catch (e) {
      // Ignorer les erreurs de logout
    }

    sessions.delete(sessionId)
  }

  const dir =
    path.join(
      SESSIONS_DIR,
      sessionId
    )

  if (fs.existsSync(dir)) {
    fs.rmSync(dir, {
      recursive: true,
      force: true,
    })
  }
}

module.exports = {
  startSession,
  bootAll,
  getSession,
  listSessions,
  deleteSession,
}