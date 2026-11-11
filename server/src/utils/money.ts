/**
 * All money is stored and computed as integer paise (1 INR = 100 paise).
 * Never use floating point for ledger math; convert only at the edges.
 */
export const MAX_PAISE = 100_000_000_00; // ₹10 crore per single entry

export function assertPaise(value: number, label = 'amount'): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer number of paise`);
  }
  if (value > MAX_PAISE) throw new RangeError(`${label} is too large`);
}

/** Parses "1234", "1,234.5", "₹ 99.99" into paise using string math (no floats). */
export function rupeesToPaise(input: string | number): number {
  const raw = typeof input === 'number' ? input.toFixed(2) : input;
  const cleaned = raw.replace(/[₹,\s]/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new RangeError(`Invalid amount: ${String(input)}`);
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? '').padEnd(2, '0') || '0');
  const total = rupees * 100 + paise;
  if (!Number.isSafeInteger(total)) throw new RangeError('Amount is too large');
  return total;
}

export function paiseToRupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, '0');
  return `${sign}${rupees}.${rem}`;
}

/** Indian digit grouping: 1,23,456.78 */
export function formatINR(paise: number): string {
  const [whole = '0', frac = '00'] = paiseToRupees(Math.abs(paise)).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${paise < 0 ? '-' : ''}₹${grouped}.${frac}`;
}
