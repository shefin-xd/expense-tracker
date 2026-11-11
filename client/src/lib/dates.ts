/** Every date in the app is an Asia/Kolkata calendar day. API values are ISO instants. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

/** "YYYY-MM-DD" of the IST day containing this instant. */
export function istDay(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d) : d;
  return new Date(t.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
export const todayIST = () => istDay(new Date());
export const thisMonthIST = () => todayIST().slice(0, 7);

/** Start / end of an IST day as ISO instants, for API range filters. */
export const istStart = (day: string) => new Date(`${day}T00:00:00.000+05:30`).toISOString();
export const istEnd = (day: string) => new Date(`${day}T23:59:59.999+05:30`).toISOString();

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
export function lastDayOfMonth(month: string): string {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}
/** Monday of the week containing this day. */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

export function formatDate(iso: string | Date | null | undefined, fmt: DateFormat = 'DD/MM/YYYY'): string {
  if (!iso) return '—';
  const [y, m, d] = istDay(iso).split('-') as [string, string, string];
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
  return fmt === 'MM/DD/YYYY' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthLabel(month: string): string {
  const [y, m] = month.split('-') as [string, string];
  return `${MONTHS[Number(m) - 1]} ${y}`;
}
/** "Today", "Tomorrow", "in 5 days", "3 days overdue". */
export function relativeDue(iso: string, today = todayIST()): string {
  const n = daysBetween(today, istDay(iso));
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n > 1) return `Due in ${n} days`;
  return n === -1 ? '1 day overdue' : `${-n} days overdue`;
}
/** Academic year like "2026-27" for a given day (June start). */
export function academicYearOf(day = todayIST()): string {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const start = m >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
