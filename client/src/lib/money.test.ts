import { describe, expect, it } from 'vitest';
import { formatINR, formatINRShort, normalizeAmount, normalizeAmountOrZero, paiseToInput } from './money';

describe('formatINR', () => {
  it('uses Indian grouping', () => {
    expect(formatINR(123456789)).toBe('₹12,34,567.89');
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(99999)).toBe('₹999.99');
    expect(formatINR(100000)).toBe('₹1,000.00');
    expect(formatINR(10000000)).toBe('₹1,00,000.00');
  });
  it('handles negatives and explicit signs', () => {
    expect(formatINR(-50050)).toBe('−₹500.50');
    expect(formatINR(500, { sign: true })).toBe('+₹5.00');
  });
  it('shortens for axes', () => {
    expect(formatINRShort(4500000)).toBe('₹45K');
    expect(formatINRShort(12000000)).toBe('₹1.2L');
    expect(formatINRShort(5000)).toBe('₹50');
  });
});

describe('normalizeAmount', () => {
  it('normalises without floats', () => {
    expect(normalizeAmount('0.1')).toBe('0.10');
    expect(normalizeAmount('1,250.5')).toBe('1250.50');
    expect(normalizeAmount('₹ 99')).toBe('99.00');
    expect(normalizeAmount('007')).toBe('7.00');
  });
  it('rejects bad input', () => {
    for (const bad of ['', 'abc', '-5', '0', '0.00', '1.234', '1e3', '12.', '.5', '1000000000'])
      expect(normalizeAmount(bad)).toBeNull();
  });
  it('allows zero only where asked', () => {
    expect(normalizeAmountOrZero('0')).toBe('0.00');
    expect(normalizeAmountOrZero('0.00')).toBe('0.00');
    expect(normalizeAmountOrZero('12')).toBe('12.00');
    expect(normalizeAmountOrZero('-1')).toBeNull();
  });
  it('round-trips with paiseToInput', () => {
    expect(paiseToInput(125050)).toBe('1250.50');
    expect(paiseToInput(5)).toBe('0.05');
  });
});
