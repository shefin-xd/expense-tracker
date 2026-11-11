/** All "month" and "day" boundaries are computed in Asia/Kolkata (UTC+05:30, no DST). */
const IST_MS = 330 * 60 * 1000;

export function monthRangeIST(month: string): { from: Date; to: Date } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) throw new RangeError('Month must look like 2026-11');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return {
    from: new Date(Date.UTC(y, mo - 1, 1) - IST_MS),
    to: new Date(Date.UTC(y, mo, 1) - IST_MS - 1),
  };
}

export function yearRangeIST(year: number): { from: Date; to: Date } {
  return { from: new Date(Date.UTC(year, 0, 1) - IST_MS), to: new Date(Date.UTC(year + 1, 0, 1) - IST_MS - 1) };
}

export function currentMonthIST(now = new Date()): string {
  const d = new Date(now.getTime() + IST_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentYearIST(now = new Date()): number {
  return new Date(now.getTime() + IST_MS).getUTCFullYear();
}

export function dayKeyIST(d: Date): string {
  return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDayIST(d: Date): Date {
  return new Date(Math.floor((d.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS);
}

export function endOfDayIST(d: Date): Date {
  return new Date(startOfDayIST(d).getTime() + DAY_MS - 1);
}

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export function formatDateIST(d: Date, fmt: DateFormat = 'DD/MM/YYYY'): string {
  const [y, m, day] = dayKeyIST(d).split('-') as [string, string, string];
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${day}`;
  return fmt === 'MM/DD/YYYY' ? `${m}/${day}/${y}` : `${day}/${m}/${y}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** The IST calendar day of `d`, as a UTC-midnight Date, so spreadsheet cells show the right day. */
export function istDateAsUtc(d: Date): Date {
  return new Date(Math.floor((d.getTime() + IST_MS) / DAY_MS) * DAY_MS);
}

/** Every "YYYY-MM" between two instants (inclusive), in IST. */
export function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  let [y, m] = currentMonthIST(from).split('-').map(Number) as [number, number];
  const end = currentMonthIST(to);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(key);
    if (key >= end) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
