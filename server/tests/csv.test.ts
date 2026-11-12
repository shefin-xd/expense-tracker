import { describe, expect, it } from 'vitest';
import { csvCell, guardFormula, toCsv } from '../src/exports/csv';
import { dayEndIST, dayStartIST, excelDateIST, formatDateIST, monthRangeIST } from '../src/utils/dates';

describe('csv safety', () => {
  it('neutralises spreadsheet formulas in text cells but not in numbers', () => {
    for (const evil of ['=1+1', '+cmd', '-2+3', '@SUM(A1)', '\tx', '\rx']) expect(guardFormula(evil).startsWith("'")).toBe(true);
    expect(guardFormula('Lunch')).toBe('Lunch');
    expect(csvCell({ num: '-12.50' })).toBe('-12.50');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('starts with a BOM and uses CRLF', () => {
    const out = toCsv([['a', 'b'], ['1', '2']]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain('a,b\r\n1,2\r\n');
  });
});

describe('IST date helpers', () => {
  it('computes IST day and month boundaries', () => {
    expect(dayStartIST('2026-11-06').toISOString()).toBe('2026-11-05T18:30:00.000Z');
    expect(dayEndIST('2026-11-06').toISOString()).toBe('2026-11-06T18:29:59.999Z');
    expect(monthRangeIST('2026-02').to.toISOString()).toBe('2026-02-28T18:29:59.999Z');
  });
  it('formats dd/mm/yyyy in IST (a late-UTC time is already tomorrow in India)', () => {
    expect(formatDateIST(new Date('2026-11-05T20:00:00Z'))).toBe('06/11/2026');
    expect(excelDateIST(new Date('2026-11-05T20:00:00Z')).toISOString()).toBe('2026-11-06T00:00:00.000Z');
  });
});
