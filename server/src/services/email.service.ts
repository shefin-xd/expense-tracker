import { env, isProd } from '../config/env';

export interface Mail { to: string; subject: string; text: string; html: string; category?: string }

/** Test-only: every email is captured here instead of being sent. */
export const outbox: Mail[] = [];

const LIVE_URL = 'https://send.api.mailtrap.io/api/send';
const sandboxUrl = (inboxId: string) => `https://sandbox.api.mailtrap.io/api/send/${inboxId}`;

export type EmailMode = 'live' | 'sandbox' | 'console';
export const emailMode = (): EmailMode => (!env.MAILTRAP_API_TOKEN ? 'console' : env.MAILTRAP_INBOX_ID ? 'sandbox' : 'live');

/** "CampusLedger <no-reply@example.com>" -> { name, email } */
export function parseAddress(value: string): { email: string; name?: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (!m) return { email: value.trim() };
  const name = m[1]!.trim();
  return name ? { email: m[2]!.trim(), name } : { email: m[2]!.trim() };
}

/** One call to Mailtrap's Email API. Throws with Mailtrap's own error text (never the token). */
export async function sendViaMailtrap(mail: Mail): Promise<void> {
  const url = env.MAILTRAP_INBOX_ID ? sandboxUrl(env.MAILTRAP_INBOX_ID) : LIVE_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.MAILTRAP_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: parseAddress(env.EMAIL_FROM),
      to: [{ email: mail.to }],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      category: mail.category ?? 'CampusLedger',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { errors?: unknown; error?: unknown; message?: unknown };
      detail = JSON.stringify(body.errors ?? body.error ?? body.message ?? '').slice(0, 300);
    } catch { /* empty or non-JSON body */ }
    throw new Error(`Mailtrap responded ${res.status}${detail ? `: ${detail}` : ''}`);
  }
}

export async function sendMail(mail: Mail): Promise<void> {
  if (env.NODE_ENV === 'test') { outbox.push(mail); return; }
  if (emailMode() === 'console') {
    // Development convenience: show the message (and its link) in the server console.
    if (!isProd) console.log(`\n[email to ${mail.to}] ${mail.subject}\n${mail.text}\n`);
    else console.warn('MAILTRAP_API_TOKEN is not set, so no email was sent.');
    return;
  }
  await sendViaMailtrap(mail);
}

/** One line for the startup log so a misconfigured deploy is obvious. */
export function describeEmail(): string {
  switch (emailMode()) {
    case 'live': return `Email: Mailtrap live sending as ${env.EMAIL_FROM}`;
    case 'sandbox': return `Email: Mailtrap TESTING inbox ${env.MAILTRAP_INBOX_ID} (messages are captured, not delivered)`;
    default: return isProd ? 'Email: NOT configured (set MAILTRAP_API_TOKEN). Password-reset emails will not be sent.' : 'Email: not configured, reset links are printed in this console.';
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function resetEmail(name: string, link: string, minutes: number): Omit<Mail, 'to'> {
  return {
    category: 'Password reset',
    subject: 'Reset your CampusLedger password',
    text: `Hi ${name},\n\nUse this link to choose a new password. It works once and expires in ${minutes} minutes:\n\n${link}\n\nIf you did not ask for this, you can ignore this email. Your password stays the same.\n\nCampusLedger`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#090B10"><p>Hi ${esc(name)},</p><p>Use this link to choose a new password. It works once and expires in ${minutes} minutes.</p><p><a href="${esc(link)}" style="display:inline-block;background:#142B52;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Choose a new password</a></p><p style="color:#667085;font-size:13px">If the button does not work, paste this into your browser:<br>${esc(link)}</p><p style="color:#667085;font-size:13px">If you did not ask for this, ignore this email. Your password stays the same.</p></div>`,
  };
}
