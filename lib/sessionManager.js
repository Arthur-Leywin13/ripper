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

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions')

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

const sessions = new Map()

function authPath(sessionId) {
  return path.join(SESSIONS_DIR, sessionId, 'auth_info')
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function getPhoneNumber(sock, state) {
  const id = sock?.user?.id || state?.creds?.me?.id || ''
  return normalizePhone(id.split(':')[0].split('@')[0])
}

function listExistingSessionIds() {
  if (!fs.existsSync(SESSIONS_DIR)) return []

  return fs.readdirSync(SESSIONS_DIR).filter((name) =>
    fs.existsSync(
      path.join(SESSIONS_DIR, name, 'auth_info')
    )
  )
}

async function startSession(sessionId, opts = {}) {
  const {
    pairNumber,
    notifyTarget,
    onQr,
    onOpen,
  } = opts

  const { state, saveCreds } =
    await useMultiFileAuthState(
      authPath(sessionId)
    )

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  })

  const previous = sessions.get(sessionId)

  sessions.set(sessionId, {
    sock,
    status: 'connecting',
    phoneNumber:
      previous?.phoneNumber ||
      getPhoneNumber(sock, state),
  })

  if (pairNumber && !state.creds.registered) {
    try {
      const code = await sock.requestPairingCode(
        normalizePhone(pairNumber)
      )

      const text =
        `Code de pairing pour *${sessionId}*: \`${code}\`\n\n` +
        `WhatsApp → Appareils connectés → Lier un appareil → ` +
        `Lier avec le numéro de téléphone → entre ce code.`

      if (notifyTarget) {
        await notifyTarget.sock.sendMessage(
          notifyTarget.jid,
          { text }
        )
      } else {
        console.log(text)
      }
    } catch (err) {
      const text =
        `Impossible de générer le code de pairing pour ${sessionId}: ${err.message}`

      if (notifyTarget) {
        await notifyTarget.sock.sendMessage(
          notifyTarget.jid,
          { text }
        )
      } else {
        console.error(text)
      }
    }
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on(
    'connection.update',
    async (update) => {
      const {
        connection,
        lastDisconnect,
        qr,
      } = update

      if (qr && !pairNumber) {
        try {
          const qrDataUrl =
            await QRCode.toDataURL(qr, {
              type: 'image/png',
              width: 400,
              margin: 2,
            })

          if (typeof onQr === 'function') {
            await onQr(
              qrDataUrl,
              sessionId
            )
          } else {
            console.log(
              `[${sessionId}] Nouveau QR généré.`
            )

            qrcodeTerminal.generate(qr, {
              small: true,
            })
          }

          if (notifyTarget) {
            const png =
              await QRCode.toBuffer(qr, {
                type: 'png',
                width: 512,
              })

            await notifyTarget.sock.sendMessage(
              notifyTarget.jid,
              {
                image: png,
                caption:
                  `QR pour la session *${sessionId}*. ` +
                  `Scanne-le rapidement.`,
              }
            )
          }
        } catch (err) {
          console.error(
            `[${sessionId}] Erreur QR:`,
            err
          )
        }
      }

      if (connection === 'open') {
        const session =
          sessions.get(sessionId)

        if (session) {
          session.status = 'connected'
          session.phoneNumber =
            getPhoneNumber(sock, state)
        }

        console.log(
          `✅ [${sessionId}] ${config.BOT_NAME} connecté.` +
          (
            session?.phoneNumber
              ? ` +${session.phoneNumber}`
              : ''
          )
        )

        if (typeof onOpen === 'function') {
          try {
            await onOpen(
              sessionId,
              session
            )
          } catch (err) {
            console.error(
              `[${sessionId}] Erreur onOpen:`,
              err
            )
          }
        }

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

      if (connection === 'close') {
        const statusCode =
          new Boom(
            lastDisconnect?.error
          )?.output?.statusCode

        const shouldReconnect =
          statusCode !==
          DisconnectReason.loggedOut

        const current =
          sessions.get(sessionId)

        if (current) {
          current.status = 'disconnected'
        }

        console.log(
          `[${sessionId}] Connexion fermée.`,
          shouldReconnect
            ? 'Reconnexion...'
            : 'Déconnecté.'
        )

        if (shouldReconnect) {
          try {
            await startSession(
              sessionId,
              opts
            )
          } catch (err) {
            console.error(
              `[${sessionId}] Erreur reconnexion:`,
              err
            )
          }
        } else {
          sessions.delete(sessionId)
        }
      }
    }
  )

  sock.ev.on(
    'messages.upsert',
    async ({ messages }) => {
      for (const msg of messages || []) {
        if (!msg?.message) continue

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
    }
  )

  return sock
}

async function bootAll() {
  const existing =
    listExistingSessionIds()

  const declared =
    config.SESSION_IDS
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

  const toStart = new Set([
    ...existing,
    ...declared,
  ])

  for (const id of toStart) {
    try {
      await startSession(id)
    } catch (err) {
      console.error(
        `[${id}] Impossible de démarrer:`,
        err
      )
    }
  }
}

function getSession(sessionId) {
  return sessions.get(sessionId)
}

function listSessions() {
  return Array.from(
    sessions.entries()
  ).map(([id, session]) => ({
    id,
    status: session.status,
    phoneNumber:
      session.phoneNumber || null,
  }))
}

async function deleteSession(sessionId) {
  const session =
    sessions.get(sessionId)

  if (session) {
    try {
      await session.sock.logout()
    } catch (_) {}

    sessions.delete(sessionId)
  }

  const dir = path.join(
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