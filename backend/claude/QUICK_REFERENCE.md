// ============================================
// PDF Scheduler - Quick Reference
// ============================================

// STEP 1: Add to your package.json (if not already there)
// "node-cron": "^3.0.2"

// STEP 2: Import at top of your server code
const { sendPDF, setupPDFScheduler, handlePDFCommand, PDF_CONFIG } = require('./pdf-scheduler-module');

// ============================================
// FUNCTION USAGE
// ============================================

// 1️⃣ SETUP SCHEDULER (When bot connects)
setupPDFScheduler(sock);
// Automatically sends PDF at: 09:00, 12:00, 15:00, 18:00, 21:00

// 2️⃣ SEND PDF IMMEDIATELY
await sendPDF(sock, '919876543210');
// Sends PDF right now to specified number

// 3️⃣ HANDLE PDF COMMANDS (In message handler)
if (msg.message?.conversation) {
  const handled = await handlePDFCommand(sock, sender, msg.message.conversation);
  if (handled) return; // Command was PDF-related
}

// ============================================
// CONFIGURATION
// ============================================

// File: pdf-scheduler-module.js (Line 8-12)

const PDF_CONFIG = {
  filePath: './documents/report.pdf',        // Change to your PDF path
  recipientPhone: '919876543210',            // Change to your number (no +)
  scheduleTimes: ['09:00', '12:00', '15:00', '18:00', '21:00'], // Change times
};

// ============================================
// USER COMMANDS (From WhatsApp)
// ============================================

Users can send:
- "send pdf now"  → Bot sends PDF immediately
- "pdf status"    → Bot shows scheduler info
- "pdf help"      → Bot shows available commands

// ============================================
// FILE STRUCTURE
// ============================================

your-render-server/
├── server.js                    (your main file)
├── pdf-scheduler-module.js      (new module - add this)
├── documents/
│   └── report.pdf              (your PDF file)
├── package.json                (make sure node-cron is listed)
└── node_modules/

// ============================================
// COMPLETE EXAMPLE (Minimal)
// ============================================

// In your existing server.js:

const express = require('express');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { sendPDF, setupPDFScheduler, handlePDFCommand } = require('./pdf-scheduler-module');

const app = express();
let sock;

async function initializeBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  sock = makeWASocket({ auth: state });

  sock.ev.on('connection.update', (update) => {
    if (update.connection === 'open') {
      console.log('✅ Connected!');
      setupPDFScheduler(sock);  // ← Add PDF scheduler here
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && msg.message?.conversation) {
      const handled = await handlePDFCommand(sock, msg.key.remoteJid, msg.message.conversation);
      if (handled) return; // PDF command handled
      
      // Your other message handling here...
    }
  });
}

app.listen(3000, () => {
  initializeBot();
  console.log('Server running on port 3000');
});

// ============================================
// THAT'S IT!
// ============================================

// Bot will now:
// ✅ Send PDF at 09:00, 12:00, 15:00, 18:00, 21:00 every day
// ✅ Accept commands: "send pdf now", "pdf status", "pdf help"
// ✅ Run on your existing Render server
// ✅ No additional server needed
