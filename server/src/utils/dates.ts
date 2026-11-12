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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const isDateOnly = (s: string) => DATE_ONLY.test(s);

/** Start of an IST calendar day given "YYYY-MM-DD". */
export function dayStartIST(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - IST_MS);
}
export const dayEndIST = (day: string): Date => new Date(dayStartIST(day).getTime() + 24 * 60 * 60 * 1000 - 1);

/** dd/mm/yyyy in IST, the Indian convention. */
export function formatDateIST(d: Date): string {
  const [y, m, day] = dayKeyIST(d).split('-') as [string, string, string];
  return `${day}/${m}/${y}`;
}

/** A Date whose UTC calendar day equals the IST day, so Excel shows the right date. */
export function excelDateIST(d: Date): Date {
  return new Date(`${dayKeyIST(d)}T00:00:00.000Z`);
}
