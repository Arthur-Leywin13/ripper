const sessionManager = require('./lib/sessionManager')
const webServer = require('./lib/webServer')

sessionManager.bootAll().catch((err) => {
  console.error('Erreur au démarrage des sessions:', err)
  process.exit(1)
})

webServer.start()
