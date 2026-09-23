const DEFAULTS = {
  OWNER_NAME: 'Arthur',
  DEFAULT_PREFIX: '.',
  BOT_NAME: 'Jack the Ripper',
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  YTDL_MAX_DURATION_SECONDS: 600,
}

module.exports = {
  OWNER_NAME: process.env.OWNER_NAME || DEFAULTS.OWNER_NAME,
  OWNER_NUMBER: process.env.OWNER_NUMBER || '',
  DEFAULT_PREFIX:
    process.env.DEFAULT_PREFIX || DEFAULTS.DEFAULT_PREFIX,

  BOT_NAME:
    process.env.BOT_NAME || DEFAULTS.BOT_NAME,

  OPENWEATHER_API_KEY:
    process.env.OPENWEATHER_API_KEY || '',

  GROQ_API_KEY:
    process.env.GROQ_API_KEY || '',

  GROQ_MODEL:
    process.env.GROQ_MODEL || DEFAULTS.GROQ_MODEL,

  YTDL_MAX_DURATION_SECONDS: Number(
    process.env.YTDL_MAX_DURATION_SECONDS ||
      DEFAULTS.YTDL_MAX_DURATION_SECONDS
  ),

  WEB_ACCESS_KEY:
    process.env.WEB_ACCESS_KEY || '',

  SESSION_IDS:
    process.env.SESSION_IDS || 'main',
}

