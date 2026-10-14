import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import type { WASocket } from '@whiskeysockets/baileys';
import { env } from '../config/env';

const PDF = env.whatsapp.pdf;

/** Read the configured PDF from disk and send it to one WhatsApp number.
 *  `phoneNumber` is digits only, no "+". Returns true on success. */
export async function sendPDF(sock: WASocket, phoneNumber: string): Promise<boolean> {
  try {
    if (!fs.existsSync(PDF.filePath)) {
      console.error(`[pdf] file not found: ${PDF.filePath}`);
      return false;
    }

    const pdfBuffer = fs.readFileSync(PDF.filePath);
    const recipient = `${phoneNumber}@s.whatsapp.net`;

    await sock.sendMessage(recipient, {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName: path.basename(PDF.filePath),
      caption: `📄 PDF Document\nTime: ${new Date().toLocaleTimeString('en-IN')}`,
    });

    console.log(`[pdf] sent to ${phoneNumber} at ${new Date().toLocaleTimeString('en-IN')}`);
    return true;
  } catch (error) {
    console.error(`[pdf] error sending: ${(error as Error).message}`);
    return false;
  }
}

/** Register a daily cron job for each configured send time. */
export function setupPDFScheduler(sock: WASocket): void {
  if (!PDF.recipientPhone) {
    console.warn('[pdf] PDF_RECIPIENT_PHONE is empty — scheduler not started.');
    return;
  }

  console.log(`[pdf] scheduling sends at: ${PDF.scheduleTimes.join(', ')}`);

  for (const time of PDF.scheduleTimes) {
    const [hour, minute] = time.split(':');
    const cronExpression = `${minute} ${hour} * * *`;

    if (!cron.validate(cronExpression)) {
      console.warn(`[pdf] skipping invalid schedule time: "${time}"`);
      continue;
    }

    cron.schedule(
      cronExpression,
      () => {
        console.log(`[pdf] ${time} — sending scheduled PDF`);
        void sendPDF(sock, PDF.recipientPhone);
      },
      { timezone: PDF.timezone },
    );
  }
}

/** Handle the chat commands. Returns true if the message was a PDF command
 *  (and was handled), so the caller can stop further processing. */
export async function handlePDFCommand(
  sock: WASocket,
  sender: string,
  command: string,
): Promise<boolean> {
  const cmd = command.toLowerCase().trim();

  if (cmd === 'send pdf now' || cmd === 'send pdf') {
    await sendPDF(sock, sender.split('@')[0]);
    return true;
  }

  if (cmd === 'pdf status' || cmd === 'pdf info') {
    const info = `📊 *PDF Scheduler Status*

📄 File: ${path.basename(PDF.filePath)}
📞 Recipient: ${PDF.recipientPhone || '(not set)'}
⏰ Schedule Times:
${PDF.scheduleTimes.map((t) => `   • ${t}`).join('\n')}

*Commands:* send pdf now · pdf status · pdf help`;

    await sock.sendMessage(sender, { text: info });
    return true;
  }

  if (cmd === 'pdf help') {
    await sock.sendMessage(sender, {
      text: `📋 *PDF Commands*\n\n1. send pdf now — send immediately\n2. pdf status — show config\n3. pdf help — this message`,
    });
    return true;
  }

  return false;
}
