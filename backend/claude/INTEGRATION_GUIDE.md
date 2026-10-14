// ============================================
// Integration Example
// Add to your existing WhatsApp bot
// ============================================

// 1. Import the PDF scheduler module at the top
const { sendPDF, setupPDFScheduler, handlePDFCommand, PDF_CONFIG } = require('./pdf-scheduler-module');

// 2. When your WhatsApp bot connects, add this:
sock.ev.on('connection.update', (update) => {
  const { connection } = update;
  
  if (connection === 'open') {
    console.log('✅ WhatsApp Connected!');
    
    // Setup PDF scheduler HERE
    setupPDFScheduler(sock);
  }
});

// 3. In your message handler, add this:
sock.ev.on('messages.upsert', async (m) => {
  const msg = m.messages[0];

  if (!msg.key.fromMe && msg.message?.conversation) {
    const text = msg.message.conversation;
    const sender = msg.key.remoteJid;

    // Check if it's a PDF command
    const isPDFCommand = await handlePDFCommand(sock, sender, text);
    
    // If it was PDF command, stop here
    if (isPDFCommand) return;

    // Otherwise, handle your other commands
    // ... your existing code ...
  }
});

// 4. Optional: Manual send from your code
// Call this anywhere to send PDF immediately:
await sendPDF(sock, PDF_CONFIG.recipientPhone);

// ============================================
// CONFIGURATION (Edit these)
// ============================================

// In pdf-scheduler-module.js, update:
const PDF_CONFIG = {
  filePath: './documents/report.pdf',        // Path to your PDF
  recipientPhone: '919876543210',            // Your WhatsApp number
  scheduleTimes: ['09:00', '12:00', '15:00', '18:00', '21:00'], // Send times
};
