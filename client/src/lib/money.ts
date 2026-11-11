/**
 * Money on the client: the API sends integer paise and accepts rupee strings.
 * Nothing here uses floating point for amounts; they are parsed and formatted as strings.
 */
export const MAX_RUPEES = 100_000_000; // matches the server's ₹10 crore per-entry cap

export function formatINR(paise: number, opts: { sign?: boolean } = {}): string {
  const neg = paise < 0;
  const abs = Math.abs(Math.trunc(paise));
  const whole = String(Math.floor(abs / 100));
  const frac = String(abs % 100).padStart(2, '0');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  const sign = neg ? '−' : opts.sign && abs > 0 ? '+' : '';
  return `${sign}₹${grouped}.${frac}`;
}

const trim = (n: number) => String(Math.round(n * 10) / 10);

/** Compact display for chart axes only: ₹1.2L, ₹45K. */
export function formatINRShort(paise: number): string {
  const r = Math.abs(paise) / 100;
  const sign = paise < 0 ? '−' : '';
  if (r >= 10_000_000) return `${sign}₹${trim(r / 10_000_000)}Cr`;
  if (r >= 100_000) return `${sign}₹${trim(r / 100_000)}L`;
  if (r >= 1_000) return `${sign}₹${trim(r / 1_000)}K`;
  return `${sign}₹${Math.round(r)}`;
}

/** Accepts "1250", "1,250.5", "₹ 99.99". Returns a clean "1250.50" string, or null if invalid or not positive. */
export function normalizeAmount(input: string): string | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const whole = m[1]!.replace(/^0+(?=\d)/, '');
  const frac = (m[2] ?? '').padEnd(2, '0');
  if (Number(whole) > MAX_RUPEES) return null;
  if (Number(whole) === 0 && Number(frac) === 0) return null;
  return `${whole}.${frac}`;
}

/** Like normalizeAmount, but 0 is allowed (e.g. amount saved so far). */
export function normalizeAmountOrZero(input: string): string | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (/^0+(\.0{1,2})?$/.test(cleaned)) return '0.00';
  return normalizeAmount(input);
}

/** Paise → editable rupee string for form fields ("1250.50"). */
export function paiseToInput(paise: number): string {
  const abs = Math.abs(Math.trunc(paise));
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Integer percentage for progress display. */
export function pct(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.min(100, Math.floor((part * 100) / whole));
}

/** "250.50" (already normalised) → 25050 paise, by string math. */
export function amountToPaise(normalized: string): number {
  const [w = '0', f = '00'] = normalized.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0').slice(0, 2));
}
