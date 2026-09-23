const sessionManager = require('./lib/sessionManager')
const webServer = require('./lib/webServer')

async function main() {
  // Le serveur HTTP est démarré une seule fois.
  await webServer.start()

  // Puis les sessions déclarées/authentifiées sont démarrées.
  await sessionManager.bootAll()
}

main().catch((err) => {
  console.error('Erreur fatale au démarrage:', err)
  process.exit(1)
})