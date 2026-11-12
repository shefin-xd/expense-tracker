import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from './features/auth/AuthPages';
import { RequireAuth } from './features/auth/RequireAuth';
import { ExpenseForm } from './features/expenses/forms';
import { FeeForm, PaymentForm } from './features/fees/forms';
import { Modal } from './components/ui/Modal';
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
  it('sends signed-out visitors to the login page', async () => {
    mockApi((r) => (r.path === '/auth/me' ? { status: 401, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } } : undefined));
    renderWithProviders(<AppRoutes />, { route: '/expenses' });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
  it('sends signed-in users away from the login page', async () => {
    signedIn((r) => (r.path === '/dashboard' ? { data: { balance: { currentPaise: 0, lentOutstandingPaise: 0, borrowedOutstandingPaise: 0 }, range: { totalIncomePaise: 0, totalExpensesPaise: 0 }, allTime: { totalIncomePaise: 0, totalExpensesPaise: 0 }, totalSavingsPaise: 0, spendingSeries: [], categoryBreakdown: [], recentTransactions: [], upcoming: { fees: [], repayments: [] } } } : undefined));
    renderWithProviders(<AppRoutes />, { route: '/login' });
    expect(await screen.findByText('Available balance')).toBeInTheDocument();
  });
  it('shows a retry state, not the login page, when the server is down', async () => {
    mockApi((r) => (r.path === '/auth/me' ? { status: 500, error: { code: 'INTERNAL', message: 'Something went wrong' } } : undefined));
    renderWithProviders(<Routes><Route element={<RequireAuth />}><Route index element={<p>secret</p>} /></Route></Routes>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});

describe('login', () => {
  it('validates, then shows a plain error for wrong credentials', async () => {
    const user = userEvent.setup();
    mockApi((r) => (r.path === '/auth/login' ? { status: 401, error: { code: 'UNAUTHORIZED', message: 'Incorrect email or password' } } : undefined));
    renderWithProviders(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match');
  });
});

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

describe('forgot and reset password screens', () => {
  const token = 'a'.repeat(64);
  it('asks for an email, then shows the same neutral confirmation', async () => {
    const user = userEvent.setup();
    const calls = mockApi((r) => (r.path === '/auth/forgot-password' ? { data: { message: 'ok' } } : undefined));
    renderWithProviders(<ForgotPasswordPage />);
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'who@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/a reset link is on its way/)).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/auth/forgot-password')!.body).toEqual({ email: 'who@example.com' });
  });
  it('rejects mismatched or weak passwords before calling the server', async () => {
    const user = userEvent.setup();
    const calls = mockApi(() => undefined);
    renderWithProviders(<ResetPasswordPage />, { route: `/reset-password?token=${token}` });
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'different1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('The passwords do not match')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
  it('sends the token with the new password and goes to sign in', async () => {
    const user = userEvent.setup();
    const calls = mockApi((r) => (r.path === '/auth/reset-password' ? { data: null } : undefined));
    renderWithProviders(<><Routes><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/login" element={<p>login page</p>} /></Routes><Toaster /></>, { route: `/reset-password?token=${token}` });
    await user.type(screen.getByLabelText('New password'), 'BrandNew123');
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNew123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/auth/reset-password')!.body).toEqual({ token, password: 'BrandNew123' });
  });
  it('offers a new link when the old one has expired, and when the link is malformed', async () => {
    const user = userEvent.setup();
    mockApi((r) => (r.path === '/auth/reset-password' ? { status: 400, error: { code: 'BAD_REQUEST', message: 'This reset link has expired or was already used. Ask for a new one.' } } : undefined));
    const first = renderWithProviders(<ResetPasswordPage />, { route: `/reset-password?token=${token}` });
    await user.type(screen.getByLabelText('New password'), 'BrandNew123');
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNew123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('link', { name: 'Get a new link' })).toBeInTheDocument();
    first.unmount();
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=oops' });
    expect(screen.getByRole('heading', { name: 'This link is not valid' })).toBeInTheDocument();
  });
  it('is reachable while signed out, and the login page links to it', async () => {
    mockApi((r) => (r.path === '/auth/me' ? { status: 401, error: { code: 'UNAUTHORIZED', message: 'x' } } : undefined));
    renderWithProviders(<AppRoutes />, { route: '/reset-password?token=zzz' });
    expect(await screen.findByRole('heading', { name: 'This link is not valid' })).toBeInTheDocument();
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
  });
});
