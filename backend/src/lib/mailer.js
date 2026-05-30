import nodemailer from 'nodemailer';

export async function sendMail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === 'true', auth: {
      user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, }, });

  await transporter.sendMail({
    from: process.env.SMTP_FROM, to, subject, html, });
}
