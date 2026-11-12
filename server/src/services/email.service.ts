import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProd } from '../config/env';

export interface Mail { to: string; subject: string; text: string; html: string }

/** Test-only: every email is captured here instead of being sent. */
export const outbox: Mail[] = [];

let transport: Transporter | undefined;
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } } : {}),
  });
  return transport;
}

export const emailConfigured = () => !!env.SMTP_HOST;

export async function sendMail(mail: Mail): Promise<void> {
  if (env.NODE_ENV === 'test') { outbox.push(mail); return; }
  if (!env.SMTP_HOST) {
    // Development convenience: show the message (and its link) in the server console.
    if (!isProd) console.log(`\n[email to ${mail.to}] ${mail.subject}\n${mail.text}\n`);
    else console.warn('SMTP_HOST is not set, so no email was sent.');
    return;
  }
  await getTransport().sendMail({ from: env.EMAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function resetEmail(name: string, link: string, minutes: number): Omit<Mail, 'to'> {
  return {
    subject: 'Reset your CampusLedger password',
    text: `Hi ${name},\n\nUse this link to choose a new password. It works once and expires in ${minutes} minutes:\n\n${link}\n\nIf you did not ask for this, you can ignore this email. Your password stays the same.\n\nCampusLedger`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#090B10"><p>Hi ${esc(name)},</p><p>Use this link to choose a new password. It works once and expires in ${minutes} minutes.</p><p><a href="${esc(link)}" style="display:inline-block;background:#142B52;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Choose a new password</a></p><p style="color:#667085;font-size:13px">If the button does not work, paste this into your browser:<br>${esc(link)}</p><p style="color:#667085;font-size:13px">If you did not ask for this, ignore this email. Your password stays the same.</p></div>`,
  };
}
