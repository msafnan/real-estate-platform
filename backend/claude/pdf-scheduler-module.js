// ============================================
// PDF Scheduler Module
// Add this to your existing Render server
// ============================================

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Configuration
const PDF_CONFIG = {
  filePath: './documents/report.pdf',
  recipientPhone: '919876543210', // Your phone (no +)
  scheduleTimes: ['09:00', '12:00', '15:00', '18:00', '21:00'],
};

// ============================================
// FUNCTION 1: Send PDF
// ============================================

async function sendPDF(sock, phoneNumber) {
  try {
    if (!fs.existsSync(PDF_CONFIG.filePath)) {
      console.error(`❌ PDF not found: ${PDF_CONFIG.filePath}`);
      return false;
    }

    const pdfBuffer = fs.readFileSync(PDF_CONFIG.filePath);
    const recipient = `${phoneNumber}@s.whatsapp.net`;

    await sock.sendMessage(recipient, {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName: path.basename(PDF_CONFIG.filePath),
      caption: `📄 PDF Document\nTime: ${new Date().toLocaleTimeString('en-IN')}`,
    });

    console.log(`✅ PDF sent at ${new Date().toLocaleTimeString('en-IN')}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending PDF: ${error.message}`);
    return false;
  }
}

// ============================================
// FUNCTION 2: Setup Scheduler
// ============================================

function setupPDFScheduler(sock) {
  console.log('⏰ Setting up PDF scheduler...');
  console.log(`📤 Will send PDF at: ${PDF_CONFIG.scheduleTimes.join(', ')}\n`);

  PDF_CONFIG.scheduleTimes.forEach((time) => {
    const [hour, minute] = time.split(':');
    const cronExpression = `${minute} ${hour} * * *`;

    cron.schedule(cronExpression, () => {
      console.log(`\n⏰ ${time} - Sending PDF...`);
      sendPDF(sock, PDF_CONFIG.recipientPhone);
    });

    console.log(`✅ Scheduled: PDF sends at ${time} every day`);
  });
}

// ============================================
// FUNCTION 3: Handle PDF Commands
// ============================================

async function handlePDFCommand(sock, sender, command) {
  const cmd = command.toLowerCase().trim();

  if (cmd === 'send pdf now' || cmd === 'send pdf') {
    await sendPDF(sock, sender.split('@')[0]);
    return true;
  }

  if (cmd === 'pdf status' || cmd === 'pdf info') {
    const info = `📊 **PDF Scheduler Status**

📄 File: ${path.basename(PDF_CONFIG.filePath)}
📞 Recipient: ${PDF_CONFIG.recipientPhone}
⏰ Schedule Times:
${PDF_CONFIG.scheduleTimes.map((t) => `   • ${t}`).join('\n')}

✅ Scheduler is running!

**PDF Commands:**
• send pdf now - Send immediately
• pdf status - Show this info
• pdf help - Show commands`;

    await sock.sendMessage(sender, { text: info });
    return true;
  }

  if (cmd === 'pdf help') {
    const help = `📋 **PDF Scheduler Commands:**

1️⃣ *send pdf now* - Send PDF immediately
2️⃣ *pdf status* - Show scheduler status
3️⃣ *pdf help* - Show this message`;

    await sock.sendMessage(sender, { text: help });
    return true;
  }

  return false;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  sendPDF,
  setupPDFScheduler,
  handlePDFCommand,
  PDF_CONFIG,
};
