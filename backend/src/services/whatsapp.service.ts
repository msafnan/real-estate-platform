import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import { env } from '../config/env';
import { handlePDFCommand, setupPDFScheduler } from './pdf.service';

let sock: WASocket | null = null;
let schedulerStarted = false;

/** The live socket, if connected. Lets other code (e.g. a route) trigger a
 *  manual send without re-bootstrapping the connection. */
export function getSocket(): WASocket | null {
  return sock;
}

/**
 * Bring up the WhatsApp connection and keep it alive.
 *
 * First run prints a QR code in the server logs — scan it once from the phone
 * you want to send as (WhatsApp → Linked devices → Link a device). The session
 * is then saved under WA_AUTH_DIR and reused on restart.
 *
 * Auto-reconnects on drop, except when WhatsApp reports a logout (the saved
 * session is dead and a fresh QR scan is required).
 */
export async function connectWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(env.whatsapp.authDir);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('[whatsapp] connected');
      // Guard so redeploys/reconnects don't stack duplicate cron jobs.
      if (!schedulerStarted && sock) {
        setupPDFScheduler(sock);
        schedulerStarted = true;
      }
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.warn(`[whatsapp] disconnected (code ${statusCode ?? 'unknown'})`);

      if (loggedOut) {
        console.error(
          `[whatsapp] logged out — delete "${env.whatsapp.authDir}" and restart to re-scan the QR.`,
        );
        sock = null;
        return;
      }
      // Transient drop: reconnect.
      void connectWhatsApp();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    const text = msg?.message?.conversation;
    if (!msg || msg.key.fromMe || !text || !msg.key.remoteJid || !sock) return;

    await handlePDFCommand(sock, msg.key.remoteJid, text);
  });
}
