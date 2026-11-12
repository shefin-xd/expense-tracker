/** Money is integer paise end to end. These helpers only convert at the edges (inputs and display). */
export function rupeesToPaise(input: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.replace(/[₹,\s]/g, ''));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}

export function paiseToInput(paise: number): string {
  const whole = Math.floor(Math.abs(paise) / 100);
  const frac = Math.abs(paise) % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
}

/** 1234567.89 -> ₹12,34,567.89 (Indian digit grouping) */
export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const whole = String(Math.floor(abs / 100));
  const frac = String(abs % 100).padStart(2, '0');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  const showDecimals = opts.decimals ?? true;
  return `${neg ? '-' : ''}₹${grouped}${showDecimals ? `.${frac}` : ''}`;
}

/** Whole rupees for compact chart axes: 125000 paise -> ₹1,250 */
export const formatINRShort = (paise: number) => formatINR(paise, { decimals: false });
