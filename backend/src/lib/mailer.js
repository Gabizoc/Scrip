// backend/src/lib/mailer.js
import nodemailer from 'nodemailer';

/**
 * Envoie un email via SMTP (config dans .env).
 * Throw si la livraison échoue.
 */
export async function sendMail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}
