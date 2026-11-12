import { describe, expect, it } from 'vitest';
import { buildSeries } from '@/features/dashboard/charts';
import { reportQuery } from '@/features/reports/params';
import { addDays, formatDate, formatMonth, relativeDue, shiftMonth, toDayKey } from './date';
import { formatINR, paiseToInput, rupeesToPaise } from './money';
import { eachDay, rangeDays, rangeToIso } from './ranges';
import { amountText } from './schemas';

describe('money', () => {
  it('parses rupees to exact paise', () => {
    expect(rupeesToPaise('250.50')).toBe(25050);
    expect(rupeesToPaise('0.1')).toBe(10);
    expect(rupeesToPaise('1,234')).toBe(123400);
    expect(rupeesToPaise('₹ 99.99')).toBe(9999);
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '.5']) expect(rupeesToPaise(bad)).toBeNull();
  });
  it('formats with Indian grouping and signs', () => {
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(123456789)).toBe('₹12,34,567.89');
    expect(formatINR(-250050)).toBe('-₹2,500.50');
    expect(formatINR(12500000, { decimals: false })).toBe('₹1,25,000');
  });
  it('round-trips paise through the edit field', () => {
    expect(paiseToInput(25050)).toBe('250.50');
    expect(paiseToInput(25000)).toBe('250');
    expect(rupeesToPaise(paiseToInput(10))).toBe(10);
  });
  it('validates amounts in forms', () => {
    expect(amountText.safeParse('250.50').success).toBe(true);
    expect(amountText.safeParse('0').success).toBe(false);
    expect(amountText.safeParse('').success).toBe(false);
    expect(amountText.safeParse('12.345').success).toBe(false);
    expect(amountText.safeParse('999999999').success).toBe(false);
  });
});

describe('dates are Indian time', () => {
  it('a late-UTC instant is already the next day in India', () => {
    expect(toDayKey('2026-11-05T20:00:00Z')).toBe('2026-11-06');
    expect(formatDate('2026-11-05T20:00:00Z')).toBe('06/11/2026');
    expect(formatDate('2026-11-05T20:00:00Z', 'MM/DD/YYYY')).toBe('11/06/2026');
    expect(formatDate('2026-11-05T20:00:00Z', 'YYYY-MM-DD')).toBe('2026-11-06');
    expect(formatDate(null)).toBe('');
  });
  it('shifts months across year ends', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(formatMonth('2026-11')).toBe('November 2026');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('describes due dates relative to today', () => {
    const today = toDayKey(new Date());
    expect(relativeDue(`${today}T12:00:00Z`)).toBe('Today');
    expect(relativeDue(`${addDays(today, 5)}T12:00:00Z`)).toBe('In 5 days');
    expect(relativeDue(`${addDays(today, -3)}T12:00:00Z`)).toBe('3 days ago');
  });
});

describe('dashboard ranges', () => {
  it('computes week (Monday start), month, last month, 3 months, year', () => {
    expect(rangeDays('week', '2026-11-12')).toEqual({ from: '2026-11-09', to: '2026-11-15' }); // Thursday
    expect(rangeDays('week', '2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' }); // Sunday belongs to the week before it
    expect(rangeDays('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(rangeDays('last_month', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(rangeDays('three_months', '2026-11-12')).toEqual({ from: '2026-09-01', to: '2026-11-30' });
    expect(rangeDays('three_months', '2026-02-12')).toEqual({ from: '2025-12-01', to: '2026-02-28' });
    expect(rangeDays('year', '2026-11-12')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
  it('turns IST days into the matching UTC instants', () => {
    expect(rangeToIso({ from: '2026-11-06', to: '2026-11-06' })).toEqual({ from: '2026-11-05T18:30:00.000Z', to: '2026-11-06T18:29:59.999Z' });
  });
  it('lists every day and caps long ranges', () => {
    expect(eachDay('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(eachDay('2020-01-01', '2026-01-01', 50)).toHaveLength(50);
  });
  it('shows quiet days as zero and switches to months for long ranges', () => {
    const daily = buildSeries({ from: '2026-11-01', to: '2026-11-04' }, [{ date: '2026-11-02', totalPaise: 500 }]);
    expect(daily.map((p) => p.totalPaise)).toEqual([0, 500, 0, 0]);
    const monthly = buildSeries({ from: '2026-01-01', to: '2026-12-31' }, [{ date: '2026-03-05', totalPaise: 100 }, { date: '2026-03-09', totalPaise: 50 }]);
    expect(monthly).toHaveLength(12);
    expect(monthly[2]).toEqual({ label: '2026-03', totalPaise: 150 });
  });
});

describe('report query', () => {
  const base = { mode: 'month' as const, month: '2026-11', year: 2026, from: '2026-11-01', to: '2026-11-30', academicYear: '', dataset: 'transactions', format: 'pdf' as const };
  it('maps each report type to the parameters the server expects', () => {
    expect(reportQuery({ ...base, type: 'monthly' })).toEqual({ type: 'monthly', month: '2026-11' });
    expect(reportQuery({ ...base, type: 'yearly' })).toEqual({ type: 'yearly', year: 2026 });
    expect(reportQuery({ ...base, type: 'custom' })).toEqual({ type: 'custom', from: '2026-11-01', to: '2026-11-30' });
    expect(reportQuery({ ...base, type: 'expenses', mode: 'year' })).toEqual({ type: 'expenses', year: 2026 });
    expect(reportQuery({ ...base, type: 'income', mode: 'custom' })).toEqual({ type: 'income', from: '2026-11-01', to: '2026-11-30' });
    expect(reportQuery({ ...base, type: 'fees', academicYear: '2026-27' })).toEqual({ type: 'fees', month: '2026-11', academicYear: '2026-27' });
    expect(reportQuery({ ...base, type: 'monthly', format: 'csv', dataset: 'loans' })).toEqual({ type: 'monthly', month: '2026-11', dataset: 'loans' });
  });
});
