// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { queryClient } from './lib/query';

const user = { id: 'u1', name: 'Shefin Franklin', email: 's@example.com', college: 'CET', department: 'CSE', studentYear: 'First Year', hostel: 'Men’s Hostel',
  preferences: { theme: 'light', currency: 'INR', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Kolkata', notifications: { feeDeadlines: true, budgetWarnings: true, repayments: true } } };
const expense = { id: 'e1', title: 'Canteen lunch', amountPaise: 12050, category: 'Food', date: '2026-11-10T00:00:00Z', paymentMethod: 'upi' };
const fee = { id: 'f1', title: 'Semester 3 tuition', category: 'tuition', academicYear: '2026-27', totalPaise: 5000000, paidPaise: 1000000, remainingPaise: 4000000, dueDate: '2026-12-01T00:00:00Z', status: 'partially_paid' };
const entry = { id: 't1', kind: 'expense', amountPaise: 12050, date: '2026-11-10T00:00:00Z', title: 'Canteen lunch', category: 'Food', sourceType: 'expense', sourceId: 'e1' };
const paged = (items: unknown[]) => ({ success: true, data: items, meta: { page: 1, limit: 20, total: items.length, totalPages: 1 } });
const ok = (data: unknown) => ({ success: true, data });

const routes: Record<string, unknown> = {
  '/api/dashboard': ok({
    balance: { currentPaise: 123456789, lentOutstandingPaise: 50000, borrowedOutstandingPaise: 0 }, range: { totalIncomePaise: 500000, totalExpensesPaise: 120000 },
    allTime: { totalIncomePaise: 900000, totalExpensesPaise: 300000 }, totalSavingsPaise: 25000, spendingSeries: [{ date: '2026-11-10', totalPaise: 12050 }],
    categoryBreakdown: [{ category: 'Food', totalPaise: 12050, count: 1 }], recentTransactions: [entry], upcoming: { fees: [fee], repayments: [] } }),
  '/api/fees': paged([fee]),
  '/api/notifications': ok({ items: [], unreadCount: 0 }),
  '/api/categories': ok({ defaults: ['Food', 'Snacks', 'Other'], custom: [{ id: 'c1', name: 'Gym' }] }),
  '/api/expenses': paged([expense]),
  '/api/income': paged([]),
  '/api/income/parent-summary': ok({ totalPaise: 500000, thisMonthPaise: 300000, thisYearPaise: 500000, lastReceivedDate: '2026-11-01T00:00:00Z', history: [] }),
  '/api/lending': paged([]),
  '/api/lending/summary': ok({ totalPaise: 0, repaidPaise: 0, outstandingPaise: 0 }),
  '/api/budgets/2026-11': ok({ month: '2026-11', hasBudget: true, overall: { limitPaise: 500000, spentPaise: 420000, remainingPaise: 80000, percentUsed: 84, level: 'warning' }, categories: [], spentPaise: 420000, spendingByCategory: [{ category: 'Food', totalPaise: 420000, count: 3 }] }),
  '/api/budgets/2026-11/compare': ok({ month: '2026-11', previousMonth: '2026-10', spentPaise: 420000, previousSpentPaise: 300000, changePaise: 120000 }),
  '/api/savings': ok({ goals: [{ id: 'g1', name: 'New laptop', targetPaise: 5000000, savedPaise: 1000000, remainingPaise: 4000000, percentSaved: 20, reached: false }], totalSavedPaise: 1000000, totalTargetPaise: 5000000 }),
  '/api/transactions': paged([entry]),
  '/api/transactions/summary': ok({ balancePaise: 100, totalIncomePaise: 200, totalExpensesPaise: 100 }),
  '/api/reports/summary': ok({ meta: { label: 'November 2026', scope: 'all', from: '', to: '' }, summary: { openingPaise: 0, incomePaise: 500000, expensesPaise: 120000, feePaymentsPaise: 0, netPaise: 380000, closingPaise: 380000, lentOutstandingPaise: 0, borrowedOutstandingPaise: 0, savingsPaise: 0 }, categories: [], transactionCount: 4 }),
};

let calls: { method: string; path: string; body?: unknown }[] = [];
let signedIn = true;

beforeAll(() => {
  // jsdom lacks these browser APIs.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  calls = []; signedIn = true; queryClient.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const u = new URL(input, 'http://localhost');
    const method = init?.method ?? 'GET';
    calls.push({ method, path: u.pathname, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname === '/api/auth/me') return signedIn ? json(200, ok({ user })) : json(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Please sign in' } });
    if (method === 'POST' && u.pathname === '/api/expenses') return json(201, ok(expense));
    if (method === 'GET' && u.pathname in routes) return json(200, routes[u.pathname]);
    return json(404, { success: false, error: { code: 'NOT_FOUND', message: `unmocked ${method} ${u.pathname}` } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderAt = (path: string) => render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);

describe('routing and auth', () => {
  it('sends signed-out visitors to the login page', async () => {
    signedIn = false;
    renderAt('/expenses');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });
  it('validates the login form before calling the API', async () => {
    signedIn = false;
    renderAt('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email')).toBeTruthy();
    expect(calls.some((c) => c.path === '/api/auth/login')).toBe(false);
  });
});

describe('pages render real data from the API shapes', () => {
  const cases: [string, string | RegExp][] = [
    ['/', '₹12,34,567.89'], // balance with Indian grouping
    ['/transactions', 'Canteen lunch'],
    ['/expenses', 'Canteen lunch'],
    ['/income', 'Money from parents'.slice(0, 0) + 'From parents'],
    ['/fees', 'Semester 3 tuition'],
    ['/loans', 'Nothing lent yet'],
    ['/savings', 'New laptop'],
    ['/reports', /Preview · November 2026/],
    ['/settings', 'Change password'],
  ];
  it.each(cases)('%s', async (path, text) => {
    renderAt(path);
    expect((await screen.findAllByText(text, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
  });

  it('/budgets warns when close to the limit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T06:00:00Z'));
    renderAt('/budgets');
    expect(await screen.findByText('Close to the limit', {}, { timeout: 3000 })).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows the dashboard owner name and all four quick actions', async () => {
    renderAt('/');
    expect(await screen.findByText('Hi, Shefin')).toBeTruthy();
    for (const n of ['Add expense', 'Add income', 'Add payment', 'Money received']) expect(screen.getAllByRole('button', { name: new RegExp(n) }).length).toBeGreaterThan(0);
  });
});

describe('adding an expense', () => {
  it('posts the amount as an exact rupee string, never a float', async () => {
    renderAt('/expenses');
    const add = (await screen.findAllByRole('button', { name: /Add expense/ }))[0]!;
    await userEvent.click(add);
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    const d = within(dialog);
    await userEvent.type(await d.findByLabelText('Amount'), '1,250.5');
    await userEvent.type(d.getByLabelText('Title'), 'Books');
    await userEvent.click(d.getByRole('button', { name: 'Add expense' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/api/expenses')).toBe(true));
    const post = calls.find((c) => c.method === 'POST' && c.path === '/api/expenses')!;
    expect(post.body).toMatchObject({ title: 'Books', amount: '1250.50', category: 'Food', paymentMethod: 'upi' });
  });

  it('rejects an invalid amount without calling the API', async () => {
    renderAt('/expenses');
    await userEvent.click((await screen.findAllByRole('button', { name: /Add expense/ }))[0]!);
    const d = within(await screen.findByRole('dialog', { name: 'Add expense' }));
    await userEvent.type(await d.findByLabelText('Amount'), '12.345');
    await userEvent.type(d.getByLabelText('Title'), 'X');
    await userEvent.click(d.getByRole('button', { name: 'Add expense' }));
    expect(await d.findByText(/Enter a amount like 250/)).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
