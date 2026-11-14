import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppLayout } from '@/layouts/AppLayout';
import { ApiError, setUnauthorizedHandler } from '@/services/api';

const Dashboard = lazy(() => import('@/pages/DashboardPage'));
const Transactions = lazy(() => import('@/pages/TransactionsPage'));
const Expenses = lazy(() => import('@/pages/ExpensesPage'));
const Income = lazy(() => import('@/pages/IncomePage'));
const Fees = lazy(() => import('@/pages/FeesPage'));
const BorrowLend = lazy(() => import('@/pages/BorrowLendPage'));
const Budgets = lazy(() => import('@/pages/BudgetsPage'));
const Savings = lazy(() => import('@/pages/SavingsPage'));
const Reports = lazy(() => import('@/pages/ReportsPage'));
const Settings = lazy(() => import('@/pages/SettingsPage'));
const NotFound = lazy(() => import('@/pages/NotFoundPage'));

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2 },
    },
  });
}

function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  // A 401 from any data request means the session ended: re-check who is signed in, which sends us to /login.
  useEffect(() => { setUnauthorizedHandler(() => { client.invalidateQueries({ queryKey: ['me'] }); }); }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export const AppRoutes = () => (
  <Routes>
    <Route element={<RequireAuth />}>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="income" element={<Income />} />
        <Route path="fees" element={<Fees />} />
        <Route path="borrow-lend" element={<BorrowLend />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="savings" element={<Savings />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Route>
  </Routes>
);

export default function App({ client = makeQueryClient() }: { client?: QueryClient }) {
  return (
    <ErrorBoundary>
      <Providers client={client}>
        <BrowserRouter><AppRoutes /></BrowserRouter>
        <Toaster />
      </Providers>
    </ErrorBoundary>
  );
}
