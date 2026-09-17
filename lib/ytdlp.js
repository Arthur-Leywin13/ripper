const { execFile } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(
      'yt-dlp',
      args,
      { maxBuffer: 1024 * 1024 * 50 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(stderr || err.message))
        }

        resolve(stdout)
      }
    )
  })
}

// Recherche YouTube et retourne le premier résultat
async function searchYouTube(query) {
  const out = await run([
    'ytsearch1:' + query,
    '--flat-playlist',
    '-J',
  ])

  const data = JSON.parse(out)

  const video = data.entries?.[0]

  if (!video || !video.id) {
    throw new Error('Aucun résultat trouvé sur YouTube.')
  }

  return {
    id: video.id,
    title: video.title,
    url: video.url?.startsWith('http')
      ? video.url
      : `https://www.youtube.com/watch?v=${video.id}`,
  }
}

// Récupère les informations d'une vidéo
async function getInfo(url) {
  const out = await run([
    '-J',
    '--no-playlist',
    url,
  ])

  return JSON.parse(out)
}

// Télécharge l'audio en MP3
async function downloadAudio(url) {
  const info = await getInfo(url)

  const artist =
    info.artist ||
    info.uploader ||
    info.channel ||
    'Artiste inconnu'

  const outTemplate = path.join(
    os.tmpdir(),
    `${info.id}.%(ext)s`
  )

  await run([
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--no-playlist',
    '--embed-metadata',
    '-o', outTemplate,
    url,
  ])

  const file = path.join(
    os.tmpdir(),
    `${info.id}.mp3`
  )

  if (!fs.existsSync(file)) {
    throw new Error(
      'Fichier audio introuvable après téléchargement.'
    )
  }

  return {
    file,
    title: info.title,
    artist,
  }
}

// Télécharge une vidéo en MP4
async function downloadVideo(url) {
  const info = await getInfo(url)

  const outTemplate = path.join(
    os.tmpdir(),
    `${info.id}.%(ext)s`
  )

  await run([
    '-f', 'mp4/best',
    '--no-playlist',
    '-o', outTemplate,
    url,
  ])

  const file = path.join(
    os.tmpdir(),
    `${info.id}.mp4`
  )

  if (!fs.existsSync(file)) {
    throw new Error(
      'Fichier vidéo introuvable après téléchargement.'
    )
  }

  return {
    file,
    title: info.title,
  }
}

module.exports = {
  searchYouTube,
  getInfo,
  downloadAudio,
  downloadVideo,
}