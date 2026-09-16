# Jack the Ripper — Bot WhatsApp multi-fonctions

Owner: **Arthur**

Le bot répond systématiquement dans le ton du personnage (calme, élégant, un rien inquiétant) — aucun message ne mentionne un moteur, une IA, ou une origine technique. `.about` répond aussi en restant dans le personnage si on lui demande d'où il vient.

## Installation (Termux ou serveur Linux)

```bash
# 1. Installer yt-dlp (nécessaire pour ytmp3/ytmp4/dl)
pkg install python -y        # Termux
pip install yt-dlp

# ou sur un serveur Debian/Ubuntu:
# sudo apt install python3-pip -y && pip3 install yt-dlp

# 2. Installer les dépendances Node
npm install

# 3. Configurer
# Ouvre config.js et remplis OWNER_NUMBER + OPENWEATHER_API_KEY

# 4. Lancer
npm start
```

Un QR code s'affiche dans le terminal : scanne-le avec WhatsApp (Paramètres > Appareils connectés).

## Structure

```
index.js            → connexion Baileys + routing des commandes
config.js            → owner, préfixe par défaut, clés API
lib/
  db.js              → stockage du préfixe par groupe (data.json auto-créé)
  ytdlp.js           → wrapper yt-dlp (téléchargement audio/vidéo)
  canvasCard.js       → génération des images météo/crypto
commands/
  menu.js            → .menu (vidéo + liste des commandes)
  setprefix.js       → .setprefix
  kickall.js         → .kickall (+ image)
  ban.js             → .ban / .kick (+ image)
  ytmp3.js           → .ytmp3 (musique YouTube)
  ytmp4.js           → .ytmp4 (vidéo YouTube)
  dl.js              → .dl (TikTok/Instagram/Facebook/etc.)
  weather.js         → .weather (+ image générée)
  crypto.js          → .crypto (+ image générée)
  vv.js              → .vv (révèle un vue unique)
  about.js           → .about / .owner / .who (identité, en restant dans le personnage)
  addsession.js      → .addsession / .pair (ajoute un compte WhatsApp, réservé à OWNER_NUMBER)
  sessions.js        → .sessions (réservé à OWNER_NUMBER)
  delsession.js      → .delsession (réservé à OWNER_NUMBER)
  status.js          → .status on|off (like automatique des statuts)
  ai.js              → .ai / .jack (conversation via Groq)
lib/cards/
  weatherCard.js     → génération de la carte météo (canvas)
  cryptoCard.js      → génération de la carte crypto (canvas)
  canvasUtils.js      → fond nocturne, panneaux "verre", icônes vectorielles
lib/coinMeta.js       → description/couleur/lien par crypto
lib/jackPersonaPrompt.js → prompt système pour .ai (persona stricte)
lib/statusAutoLike.js → logique du like automatique des statuts
lib/webServer.js      → page web de connexion (QR + sessions masquées)
public/index.html     → page servie par webServer.js
sessions/              → un dossier par compte connecté (créé automatiquement)
assets/
  menu.mp4           → vidéo envoyée par .menu
  img/
    kickall.jpg
    ban.jpg
    menu-bg.jpg      → dispo si tu veux l'utiliser comme fond
    profile.jpg
```

## Ajouter une commande

Crée un fichier dans `commands/`, exporte `{ name, aliases, description, execute }`.
Il sera chargé automatiquement au démarrage — aucune autre modification nécessaire.

## Multi-session (plusieurs comptes WhatsApp connectés)

Le bot peut faire tourner plusieurs comptes WhatsApp en parallèle, chacun indépendant (ses propres commandes, son propre préfixe par chat). Chaque compte répond aussi aux messages tapés depuis le téléphone auquel il est lié (`fromMe` autorisé).

**Premier démarrage** : une session `main` s'ouvre automatiquement et affiche son QR dans les logs (console locale ou onglet Logs sur Railway) — scanne-le pour la connecter.

**Ajouter d'autres comptes**, une fois `main` connectée, directement depuis WhatsApp (toi ou l'owner uniquement) :

```
.addsession client1                 → le bot t'envoie le QR en photo, scanne-le avec le nouveau numéro
.addsession client1 50912345678     → le bot t'envoie un code de pairing par texte
```

Avec le code de pairing : sur le téléphone à connecter, WhatsApp → Appareils connectés → Lier un appareil → "Lier avec le numéro de téléphone" → entrer le code reçu.

Autres commandes :
```
.sessions           → liste les comptes connectés et leur statut
.delsession client1 → déconnecte et oublie ce compte
```

Chaque session est sauvegardée dans `sessions/<id>/auth_info/` — pense à monter tout le dossier `sessions/` comme volume sur Railway (pas juste `auth_info/`) pour que les comptes additionnels survivent aussi aux redéploiements. Variable d'environnement optionnelle `SESSION_IDS=main,client1` pour déclarer des sessions à l'avance (sinon elles sont détectées automatiquement dès qu'elles existent sur disque).

## Connexion via le site web

En plus des commandes ci-dessus, une petite page web (Express) tourne en parallèle du bot :

- Un QR **reste toujours affiché**. Dès qu'il est scanné et connecté, un nouveau QR est généré automatiquement pour la personne suivante — la page reste utilisable en continu.
- En dessous, la liste des sessions déjà connectées s'affiche avec le numéro **masqué** (ex: `+50932*****8` — indicatif + 2 premiers chiffres + dernier chiffre, le reste caché).
- En local : http://localhost:3000 — sur Railway : Settings → Networking → Generate Domain, pour obtenir une URL publique.

Protection optionnelle : définis `WEB_ACCESS_KEY` en variable d'environnement, la page devient accessible uniquement via `https://ton-domaine/?key=ta_cle`. Sans cette variable, la page est ouverte à quiconque a le lien — volontairement, pour que plusieurs personnes puissent connecter leur propre compte librement.

## IA — parler avec Jack (`.ai`)

`.ai <message>` (alias `.jack`) fait répondre Jack directement, via Groq (gratuit, rapide). Le fil de la conversation est gardé en mémoire courte durée (perdu au redémarrage). Jack ne sort jamais du personnage — aucune mention d'IA, de modèle ou d'origine technique, quelle que soit la façon dont on le lui demande.

Nécessite `GROQ_API_KEY` (clé gratuite sur https://console.groq.com/keys).

## Like automatique des statuts (`.status`)

`.status on` / `.status off` — active ou désactive le like automatique (emoji aléatoire) des statuts WhatsApp vus par ce compte. Réglage propre à chaque session, contrôlable par son propriétaire (`isOwner`).

## Sécurité multi-session — deux niveaux de droits

- **`isOwner`** : vrai pour quiconque tape une commande depuis son propre compte connecté (`fromMe`). Donne accès aux réglages de sa propre session (`.setprefix`, `.status`, modération dans ses groupes).
- **`isGlobalOwner`** : vrai uniquement si la commande vient de la session dont le numéro correspond à `OWNER_NUMBER` (Arthur). Seul ce niveau donne accès à `.sessions`, `.addsession`, `.delsession` — indispensable puisque le site permet à n'importe qui de connecter un compte, sans quoi n'importe quel nouvel arrivant aurait pu gérer les sessions des autres.

## Déploiement sur Railway


1. **Pousse le projet sur GitHub** (Railway déploie depuis un repo, pas depuis un zip). Crée un repo, push ce dossier dedans.

2. **Nouveau projet Railway** → "Deploy from GitHub repo" → sélectionne le repo.
   Railway détecte le `Dockerfile` automatiquement et l'utilise (il gère l'installation de `yt-dlp` + `ffmpeg`, contrairement au buildpack Node par défaut qui ne les a pas).

3. **Variables d'environnement** (Settings → Variables), à partir de `.env.example` :
   - `OWNER_NAME`
   - `OWNER_NUMBER`
   - `DEFAULT_PREFIX`
   - `OPENWEATHER_API_KEY`
   - `GROQ_API_KEY` (pour `.ai`)
   - `WEB_ACCESS_KEY` (optionnel, protège la page de connexion)

4. **Volume persistant — étape critique** : sans ça, Jack perd sa session WhatsApp à chaque redéploiement et il faut rescanner le QR.
   Settings → Volumes → Add Volume → mount path `/app/sessions`.

5. **Déploie**, puis va dans l'onglet **Logs** : le QR code s'affiche en ASCII directement dans les logs Railway. Scanne-le avec WhatsApp (Appareils connectés) dans les ~60 secondes.

6. Une fois connecté, tant que le volume reste attaché, les redéploiements suivants ne redemandent pas le QR.

### Limites à connaître sur Railway
- Le plan gratuit met le service en veille après inactivité réseau — mais un bot WhatsApp maintient une connexion websocket active, donc en pratique il ne devrait pas s'endormir tant que la connexion Baileys tourne.
- `yt-dlp` peut être bloqué occasionnellement par YouTube depuis des IPs de datacenter (Railway en fait partie) — si `.ytmp3`/`.ytmp4` échouent souvent, c'est la cause la plus probable, pas un bug du bot.

## Notes


- `.kickall` retire tous les non-admins d'un groupe où le bot est admin — irréversible, à utiliser avec précaution (WhatsApp peut limiter les kicks en masse rapides, un délai de 1.2s est déjà appliqué entre chaque kick).
- `.crypto` : ajoute d'autres symboles dans `commands/crypto.js` (objet `COIN_IDS`), l'id vient de CoinGecko.
- `.weather` nécessite une clé gratuite sur openweathermap.org.
- Déploiement Railway/Render : le dossier `sessions/` doit persister entre les redémarrages (volume) sinon il faut rescanner le QR à chaque déploiement.
