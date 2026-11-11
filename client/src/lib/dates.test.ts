import { describe, expect, it } from 'vitest';
import { academicYearOf, addDays, addMonths, formatDate, istDay, istEnd, istStart, lastDayOfMonth, relativeDue, weekStart } from './dates';

describe('IST dates', () => {
  it('puts late-evening UTC into the next IST day', () => {
    expect(istDay('2026-10-31T20:00:00Z')).toBe('2026-11-01');
    expect(istDay('2026-10-31T18:29:59Z')).toBe('2026-10-31');
  });
  it('builds inclusive IST day bounds', () => {
    expect(istStart('2026-11-01')).toBe('2026-10-31T18:30:00.000Z');
    expect(istEnd('2026-11-01')).toBe('2026-11-01T18:29:59.999Z');
  });
  it('does calendar arithmetic', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
    expect(weekStart('2026-11-11')).toBe('2026-11-09'); // Wednesday → Monday
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday → previous Monday
  });
  it('formats by preference', () => {
    expect(formatDate('2026-11-05T00:00:00Z')).toBe('05/11/2026');
    expect(formatDate('2026-11-05T00:00:00Z', 'MM/DD/YYYY')).toBe('11/05/2026');
    expect(formatDate('2026-11-05T00:00:00Z', 'YYYY-MM-DD')).toBe('2026-11-05');
    expect(formatDate(null)).toBe('—');
  });
  it('describes deadlines', () => {
    expect(relativeDue('2026-11-11T00:00:00Z', '2026-11-11')).toBe('Due today');
    expect(relativeDue('2026-11-16T00:00:00Z', '2026-11-11')).toBe('Due in 5 days');
    expect(relativeDue('2026-11-08T00:00:00Z', '2026-11-11')).toBe('3 days overdue');
  });
  it('derives the academic year', () => {
    expect(academicYearOf('2026-11-11')).toBe('2026-27');
    expect(academicYearOf('2027-03-01')).toBe('2026-27');
    expect(academicYearOf('2099-06-01')).toBe('2099-00');
  });
});
