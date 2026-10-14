import dotenv from 'dotenv';

dotenv.config();

/** Read a required env var, throwing early at boot if it is missing. */
function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL ?? '7d',
  },
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  whatsapp: {
    // Master switch. The whole WhatsApp/PDF feature stays off unless this is
    // exactly "true", so a dropped session can never take the API down with it.
    enabled: (process.env.WHATSAPP_ENABLED ?? 'false') === 'true',
    // Where Baileys stores its login session. On an ephemeral host (Render's
    // default filesystem) this is wiped on every deploy — mount a persistent
    // disk here, or you'll re-scan the QR each redeploy.
    authDir: process.env.WA_AUTH_DIR ?? './auth_info_baileys',
    pdf: {
      filePath: process.env.PDF_FILE_PATH ?? './documents/report.pdf',
      // Recipient phone in international format, digits only, no "+".
      recipientPhone: process.env.PDF_RECIPIENT_PHONE ?? '',
      // Comma-separated 24h HH:mm times, e.g. "09:00,12:00,18:00".
      scheduleTimes: (process.env.PDF_SCHEDULE_TIMES ?? '09:00,12:00,15:00,18:00,21:00')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      // IANA timezone the schedule times are interpreted in, so "09:00" means
      // 9 AM there regardless of the host machine's own clock/region.
      timezone: process.env.PDF_TIMEZONE ?? 'Asia/Kolkata',
    },
  },
} as const;
