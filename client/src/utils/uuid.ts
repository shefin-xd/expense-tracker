/** A random id for Idempotency-Key. crypto.randomUUID needs a secure context, so fall back for plain-http LAN testing. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const b = (crypto as Crypto).getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
