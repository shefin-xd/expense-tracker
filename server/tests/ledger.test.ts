import { describe, expect, it } from 'vitest';
import { signedAmount, summarizeTotals } from '../src/services/ledger.rules';

describe('ledger rules', () => {
  it('income increases balance and counts as income', () => {
    const s = summarizeTotals({ income: 500000 });
    expect(s.balancePaise).toBe(500000);
    expect(s.totalIncomePaise).toBe(500000);
  });

  it('expenses and actual fee payments decrease balance', () => {
    const s = summarizeTotals({ income: 1000000, expense: 200000, fee_payment: 300000 });
    expect(s.balancePaise).toBe(500000);
    expect(s.totalExpensesPaise).toBe(500000);
    expect(s.feePaymentsPaise).toBe(300000);
  });

  it('a partial fee payment reduces balance only by the amount paid', () => {
    // Fee of ₹50,000 with ₹10,000 paid: only the payment posts.
    const s = summarizeTotals({ income: 6000000, fee_payment: 1000000 });
    expect(s.balancePaise).toBe(5000000);
  });

  it('lending reduces balance; repayment restores it without counting as income', () => {
    const lent = summarizeTotals({ income: 100000, lend_out: 30000 });
    expect(lent.balancePaise).toBe(70000);
    expect(lent.lentOutstandingPaise).toBe(30000);

    const repaid = summarizeTotals({ income: 100000, lend_out: 30000, lend_repayment: 10000 });
    expect(repaid.balancePaise).toBe(80000);
    expect(repaid.lentOutstandingPaise).toBe(20000);
    expect(repaid.totalIncomePaise).toBe(100000);
  });

  it('borrowing adds cash as a liability, not income; repaying is not an expense', () => {
    const borrowed = summarizeTotals({ income: 100000, borrow_in: 50000 });
    expect(borrowed.balancePaise).toBe(150000);
    expect(borrowed.totalIncomePaise).toBe(100000);
    expect(borrowed.borrowedOutstandingPaise).toBe(50000);

    const repaid = summarizeTotals({ income: 100000, borrow_in: 50000, borrow_repayment: 20000 });
    expect(repaid.balancePaise).toBe(130000);
    expect(repaid.totalExpensesPaise).toBe(0);
    expect(repaid.borrowedOutstandingPaise).toBe(30000);
  });

  it('empty ledger is all zeros', () => {
    expect(summarizeTotals({})).toEqual({
      balancePaise: 0,
      totalIncomePaise: 0,
      totalExpensesPaise: 0,
      feePaymentsPaise: 0,
      lentOutstandingPaise: 0,
      borrowedOutstandingPaise: 0,
    });
  });

  it('sums many small amounts exactly (no float drift)', () => {
    let total = 0;
    for (let i = 0; i < 1000; i++) total += signedAmount('income', 10); // 1000 x ₹0.10
    expect(summarizeTotals({ income: total }).balancePaise).toBe(10000);
  });

  it('rejects non-positive or fractional amounts', () => {
    expect(() => signedAmount('expense', 0)).toThrow();
    expect(() => signedAmount('expense', -5)).toThrow();
    expect(() => signedAmount('expense', 10.5)).toThrow();
  });
});
