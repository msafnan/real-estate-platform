import { createApp } from './app';
import { env } from './config/env';
import { connectWhatsApp } from './services/whatsapp.service';

const app = createApp();

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs at  http://localhost:${env.port}/api-docs`);
});

// Optional WhatsApp PDF scheduler. Off unless WHATSAPP_ENABLED=true, and any
// failure is logged without taking the API down.
if (env.whatsapp.enabled) {
  connectWhatsApp().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[whatsapp] failed to start:', err);
  });
}

// Graceful shutdown.
const shutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
