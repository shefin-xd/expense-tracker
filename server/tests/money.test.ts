import { describe, expect, it } from 'vitest';
import { assertPaise, formatINR, paiseToRupees, rupeesToPaise } from '../src/utils/money';

describe('money', () => {
  it('parses rupees to paise without float errors', () => {
    expect(rupeesToPaise('0.1')).toBe(10);
    expect(rupeesToPaise('0.29')).toBe(29);
    expect(rupeesToPaise('1,234.5')).toBe(123450);
    expect(rupeesToPaise('₹ 99.99')).toBe(9999);
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise('500')).toBe(50000);
  });

  it('rejects invalid amounts', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '1.2.3']) {
      expect(() => rupeesToPaise(bad)).toThrow(RangeError);
    }
  });

  it('validates paise integers', () => {
    expect(() => assertPaise(0)).toThrow();
    expect(() => assertPaise(-1)).toThrow();
    expect(() => assertPaise(1.5)).toThrow();
    expect(() => assertPaise(Number.NaN)).toThrow();
    expect(() => assertPaise(100)).not.toThrow();
  });

  it('formats with Indian grouping', () => {
    expect(paiseToRupees(12345)).toBe('123.45');
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(99900)).toBe('₹999.00');
    expect(formatINR(123456789)).toBe('₹12,34,567.89');
    expect(formatINR(-250050)).toBe('-₹2,500.50');
  });
});
