import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { RequireAuth } from './features/auth/RequireAuth';
import { ExpenseForm } from './features/expenses/forms';
import { FeeForm, PaymentForm } from './features/fees/forms';
import { Modal } from './components/ui/Modal';
import { nav, AUTH_URL } from './utils/auth';
import { RecurringPanel } from './features/recurring/RecurringPanel';
import { mockApi, renderWithProviders, USER } from './test-utils';
import { Toaster } from './components/ui/Toaster';
import type { Fee } from './types/api';

beforeEach(() => { localStorage.clear(); document.documentElement.className = ''; });

const signedIn = (extra?: Parameters<typeof mockApi>[0]) =>
  mockApi((r) => {
    if (r.path === '/auth/me') return { data: { user: USER } };
    if (r.path === '/notifications') return { data: { items: [], unreadCount: 0 } };
    if (r.path === '/categories') return { data: { defaults: ['Food', 'Snacks', 'Other'], custom: [{ id: 'c1', name: 'Gym' }] } };
    return extra?.(r);
  });

describe('route protection', () => {
  const replace = vi.spyOn(nav, 'replace').mockImplementation(() => undefined);
  const go = vi.spyOn(nav, 'go').mockImplementation(() => undefined);
  beforeEach(() => { replace.mockClear(); go.mockClear(); });

  it('sends signed-out visitors to the separate sign-in app, remembering where they were going', async () => {
    mockApi((r) => (r.path === '/auth/me' ? { status: 401, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } } : undefined));
    renderWithProviders(<AppRoutes />, { route: '/expenses' });
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    const url = new URL(replace.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe(`${AUTH_URL}/login`);
    expect(url.searchParams.get('redirect')).toContain(window.location.origin);
    expect(screen.queryByText('Available balance')).not.toBeInTheDocument();
  });

  it('shows a retry state, not a redirect, when the server is down', async () => {
    mockApi((r) => (r.path === '/auth/me' ? { status: 500, error: { code: 'INTERNAL', message: 'Something went wrong' } } : undefined));
    renderWithProviders(<AppRoutes />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this');
    expect(replace).not.toHaveBeenCalled();
  });

  it('signing out ends the session, then goes to the sign-in app with a signed-out notice', async () => {
    const user = userEvent.setup();
    const calls = signedIn((r) => (r.path === '/auth/logout' ? { data: null } : r.path === '/dashboard' ? { data: EMPTY_DASH } : undefined));
    Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true });
    renderWithProviders(<AppRoutes />);
    const signOutButtons = await screen.findAllByRole('button', { name: 'Sign out' });
    await user.click(signOutButtons[signOutButtons.length - 1]!);
    await waitFor(() => expect(go).toHaveBeenCalled());
    expect(calls.some((c) => c.method === 'POST' && c.path === '/auth/logout')).toBe(true);
    const url = new URL(go.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe(`${AUTH_URL}/login`);
    expect(url.searchParams.get('signed_out')).toBe('1');
  });
});

const EMPTY_DASH = { balance: { currentPaise: 0, lentOutstandingPaise: 0, borrowedOutstandingPaise: 0 }, range: { totalIncomePaise: 0, totalExpensesPaise: 0 }, allTime: { totalIncomePaise: 0, totalExpensesPaise: 0 }, totalSavingsPaise: 0, spendingSeries: [], categoryBreakdown: [], recentTransactions: [], upcoming: { fees: [], repayments: [] } };

describe('dashboard', () => {
  it('shows the balance and lists from the API, with negative balances flagged', async () => {
    signedIn((r) => r.path === '/dashboard' ? { data: {
      balance: { currentPaise: 123456789, lentOutstandingPaise: 50000, borrowedOutstandingPaise: 0 },
      range: { totalIncomePaise: 200000, totalExpensesPaise: 145050 }, allTime: { totalIncomePaise: 1200000, totalExpensesPaise: 165433 }, totalSavingsPaise: 1500000,
      spendingSeries: [{ date: '2026-11-02', totalPaise: 25050 }], categoryBreakdown: [{ category: 'Food', totalPaise: 25050, count: 1 }],
      recentTransactions: [{ id: 't1', kind: 'expense', amountPaise: 25050, date: '2026-11-02T06:00:00Z', title: 'Biriyani', category: 'Food' }, { id: 't2', kind: 'income', amountPaise: 200000, date: '2026-11-01T06:00:00Z', title: 'Money from parents', category: 'parents' }],
      upcoming: { fees: [{ id: 'f1', title: 'Semester fee', category: 'tuition', academicYear: '2026-27', totalPaise: 500000, paidPaise: 0, remainingPaise: 500000, dueDate: '2099-01-01T00:00:00Z', status: 'pending' }], repayments: [] },
    } } : undefined);
    renderWithProviders(<AppRoutes />);
    expect(await screen.findByText('₹12,34,567.89')).toBeInTheDocument();
    expect(screen.getByText(/Friends owe you/)).toBeInTheDocument();
    expect(screen.getByText('Biriyani')).toBeInTheDocument();
    expect(screen.getByText('Semester fee')).toBeInTheDocument();
    const list = screen.getByText('Biriyani').closest('li')!;
    expect(within(list).getByText(/−/)).toBeInTheDocument();
    expect(within(screen.getByText('Money from parents').closest('li')!).getByText(/\+/)).toBeInTheDocument();
  });
  it('shows a retry button when the dashboard fails to load', async () => {
    signedIn((r) => (r.path === '/dashboard' ? { status: 500, error: { code: 'INTERNAL', message: 'Something went wrong' } } : undefined));
    renderWithProviders(<AppRoutes />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('expense form', () => {
  it('rejects bad amounts and sends exact rupees; blank title falls back to the category', async () => {
    const user = userEvent.setup();
    const calls = signedIn((r) => (r.method === 'POST' && r.path === '/expenses' ? { status: 201, data: { id: 'e1' } } : undefined));
    const onDone = vi.fn();
    renderWithProviders(<><ExpenseForm quick onDone={onDone} /><Toaster /></>);
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(await screen.findByText('Enter an amount')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount'), '12.345');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(await screen.findByText(/Use numbers only/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '250.50');
    await user.click(await screen.findByRole('radio', { name: 'Snacks' }));
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const post = calls.find((c) => c.method === 'POST' && c.path === '/expenses')!;
    expect(post.body).toMatchObject({ amount: '250.50', category: 'Snacks', title: 'Snacks', paymentMethod: 'upi' });
    expect(post.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.parse(localStorage.getItem('cl-last-expense')!)).toMatchObject({ category: 'Snacks' });
  });
  it('remembers the last category for the next expense', async () => {
    localStorage.setItem('cl-last-expense', JSON.stringify({ category: 'Gym', paymentMethod: 'cash' }));
    signedIn();
    renderWithProviders(<ExpenseForm quick onDone={() => {}} />);
    expect(await screen.findByRole('radio', { name: 'Gym', checked: true })).toBeInTheDocument();
  });
  it('shows a server error as a toast and stays open', async () => {
    const user = userEvent.setup();
    signedIn((r) => (r.method === 'POST' ? { status: 400, error: { code: 'BAD_REQUEST', message: 'Unknown category "Gym"' } } : undefined));
    const onDone = vi.fn();
    renderWithProviders(<><ExpenseForm quick onDone={onDone} /><Toaster /></>);
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(await screen.findByText('Unknown category "Gym"')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('fee forms', () => {
  const fee: Fee = { id: 'f1', title: 'Hostel fee', category: 'hostel', academicYear: '2026-27', totalPaise: 100000, paidPaise: 70000, remainingPaise: 30000, dueDate: '2099-01-01T00:00:00Z', status: 'partially_paid' };
  it('stops overpayment before it reaches the server', async () => {
    const user = userEvent.setup();
    const calls = signedIn();
    renderWithProviders(<PaymentForm fee={fee} onDone={() => {}} />);
    const amount = screen.getByLabelText('Amount paid');
    expect(amount).toHaveValue('300');
    await user.clear(amount);
    await user.type(amount, '300.01');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('Only ₹300.00 is left to pay')).toBeInTheDocument();
    expect(calls.some((c) => c.path.includes('/payments'))).toBe(false);
  });
  it('stops lowering a fee below what is already paid', async () => {
    const user = userEvent.setup();
    signedIn();
    renderWithProviders(<FeeForm fee={fee} onDone={() => {}} />);
    const total = screen.getByLabelText('Total amount due');
    await user.clear(total);
    await user.type(total, '500');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/already paid, so the total cannot be lower/)).toBeInTheDocument();
  });
});

describe('modal accessibility', () => {
  it('closes on Escape, traps focus and returns it to the opener', async () => {
    const user = userEvent.setup();
    function Host() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Open</button><Modal open={open} onClose={() => setOpen(false)} title="Demo"><input aria-label="First" /><button>Last</button></Modal></>; }
    renderWithProviders(<Host />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Demo' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('First')).toHaveFocus();
    await user.tab(); await user.tab(); await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe('duplicate-proof saving', () => {
  it('sends an Idempotency-Key, reuses it when the same values are retried after a failure, and uses a new one after success', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    const calls = signedIn((r) => {
      if (r.method === 'POST' && r.path === '/expenses') return ++attempt === 1 ? { status: 500, error: { code: 'INTERNAL', message: 'Something went wrong' } } : { status: 201, data: { id: 'e1' } };
    });
    renderWithProviders(<><ExpenseForm quick onDone={() => {}} /><Toaster /></>);
    await user.type(screen.getByLabelText('Amount'), '75');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    await screen.findByText('Something went wrong');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/expenses')).toHaveLength(2));
    const [first, second] = calls.filter((c) => c.path === '/expenses');
    expect(first!.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(second!.headers['Idempotency-Key']).toBe(first!.headers['Idempotency-Key']);
  });

  it('changed values get a new key, so a corrected form is never mistaken for the old one', async () => {
    const user = userEvent.setup();
    const calls = signedIn((r) => (r.method === 'POST' && r.path === '/expenses' ? { status: 500, error: { code: 'INTERNAL', message: 'Something went wrong' } } : undefined));
    renderWithProviders(<><ExpenseForm quick onDone={() => {}} /><Toaster /></>);
    await user.type(screen.getByLabelText('Amount'), '75');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/expenses')).toHaveLength(1));
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '80');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(calls.filter((c) => c.path === '/expenses')).toHaveLength(2));
    const [a, b] = calls.filter((c) => c.path === '/expenses');
    expect(b!.headers['Idempotency-Key']).not.toBe(a!.headers['Idempotency-Key']);
  });
});

describe('monthly items', () => {
  const due = { id: 'r1', kind: 'income', name: 'Monthly allowance', amountPaise: 800000, dayOfMonth: 1, source: 'parents', paymentMethod: 'upi', active: true, startMonth: '2026-01', due: true, month: '2026-11', nextDueDate: '2026-11-01' };
  const upcoming = { ...due, id: 'r2', name: 'Pocket money', due: false, nextDueDate: '2026-12-01' };

  it('lists items with their status and lets you confirm what actually arrived', async () => {
    const user = userEvent.setup();
    const calls = signedIn((r) => {
      if (r.path === '/recurring' && r.method === 'GET') return { data: { items: [due, upcoming], dueCount: 1 } };
      if (r.path === '/recurring/r1/confirm') return { status: 201, data: {} };
    });
    renderWithProviders(<RecurringPanel kind="income" />);
    expect(await screen.findByText('Due now')).toBeInTheDocument();
    expect(screen.getByText('Pocket money')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm received' }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByLabelText('Amount received');
    expect(amount).toHaveValue('8000');
    await user.clear(amount);
    await user.type(amount, '6500.50');
    await user.click(within(dialog).getByRole('button', { name: 'Record money' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/recurring/r1/confirm')).toBe(true));
    expect(calls.find((c) => c.path === '/recurring/r1/confirm')!.body).toMatchObject({ amount: '6500.50' });
  });

  it('skip records nothing and calls the skip endpoint', async () => {
    const user = userEvent.setup();
    const calls = signedIn((r) => (r.path === '/recurring' && r.method === 'GET' ? { data: { items: [due], dueCount: 1 } } : r.path === '/recurring/r1/skip' ? { data: {} } : undefined));
    renderWithProviders(<RecurringPanel kind="income" />);
    await user.click(await screen.findByRole('button', { name: 'Skip this month' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/recurring/r1/skip')).toBe(true));
    expect(calls.some((c) => c.path === '/recurring/r1/confirm')).toBe(false);
  });

  it('explains the idea when there are none yet', async () => {
    signedIn((r) => (r.path === '/recurring' ? { data: { items: [], dueCount: 0 } } : undefined));
    renderWithProviders(<RecurringPanel kind="income" />);
    expect(await screen.findByText(/you confirm what actually arrived/)).toBeInTheDocument();
  });

  it('the dashboard shows due items and a getting-started checklist for new users', async () => {
    signedIn((r) => {
      if (r.path === '/dashboard') return { data: EMPTY_DASH };
      if (r.path === '/recurring') return { data: { items: [due], dueCount: 1 } };
      if (r.path === '/fees') return { data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 1 } };
      if (r.path.startsWith('/budgets/') && !r.path.endsWith('/compare')) return { data: { month: '2026-11', hasBudget: false, overall: null, categories: [], spentPaise: 0, spendingByCategory: [] } };
    });
    renderWithProviders(<AppRoutes />);
    expect(await screen.findByText('Waiting for you', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(await screen.findByText(/Getting started · 1 of 4/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Add the money you have')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hide getting started' }));
    expect(screen.queryByText(/Getting started/)).not.toBeInTheDocument();
    expect(localStorage.getItem('cl-onboarding-dismissed')).toBe('1');
  });
});
