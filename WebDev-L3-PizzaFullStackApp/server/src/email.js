import nodemailer from 'nodemailer';
import { config } from './config.js';

const transporter = config.smtp ? nodemailer.createTransport(config.smtp) : null;
export async function sendMail({ to, subject, text, html }) {
  if (!transporter) { console.info(`[email disabled] ${subject} to ${to}: ${text}`); return; }
  await transporter.sendMail({ from: config.smtpFrom, to, subject, text, html });
}
