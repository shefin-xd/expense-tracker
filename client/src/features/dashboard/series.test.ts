import { describe, expect, it } from 'vitest';
import { buildSeries, buildSlices } from './series';

describe('buildSeries', () => {
  it('fills missing days with zero and stops at today', () => {
    const out = buildSeries([{ date: '2026-11-02', totalPaise: 500 }], '2026-11-01', '2026-11-30', '2026-11-04');
    expect(out.map((b) => b.totalPaise)).toEqual([0, 500, 0, 0]);
    expect(out[0]!.label).toBe('1/11');
  });
  it('groups long ranges by month', () => {
    const out = buildSeries([{ date: '2026-01-05', totalPaise: 100 }, { date: '2026-01-20', totalPaise: 50 }, { date: '2026-03-01', totalPaise: 7 }], '2026-01-01', '2026-12-31', '2026-11-11');
    expect(out).toHaveLength(11);
    expect(out[0]).toMatchObject({ label: 'Jan', totalPaise: 150 });
    expect(out[2]!.totalPaise).toBe(7);
  });
  it('returns nothing when the range is entirely in the future', () => {
    expect(buildSeries([], '2027-01-01', '2027-01-31', '2026-11-11')).toEqual([]);
  });
});

describe('buildSlices', () => {
  it('keeps percentages summing to 100', () => {
    const s = buildSlices([{ category: 'A', totalPaise: 1 }, { category: 'B', totalPaise: 1 }, { category: 'C', totalPaise: 1 }]);
    expect(s.reduce((a, b) => a + b.percent, 0)).toBe(100);
  });
  it('buckets the tail into Other categories', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ category: `C${i}`, totalPaise: 100 - i }));
    const s = buildSlices(rows);
    expect(s).toHaveLength(7);
    expect(s.at(-1)!.name).toBe('Other categories');
    expect(s.reduce((a, b) => a + b.value, 0)).toBe(rows.reduce((a, b) => a + b.totalPaise, 0));
  });
  it('handles empty input', () => { expect(buildSlices([])).toEqual([]); });
});
