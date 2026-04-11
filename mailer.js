// services/mailer.js
import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  Email not configured — booking emails will be logged to console only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  return transporter;
}

export async function sendEmail(to, { subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [EMAIL NOT SENT — SMTP not configured]\n   To: ${to}\n   Subject: ${subject}`);
    return;
  }
  try {
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || '"Del-Migos Hotel" <no-reply@delmigos.com>',
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    throw err;
  }
}
