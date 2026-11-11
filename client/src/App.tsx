import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/feedback';
import { useMe, ME_KEY } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { setUnauthorizedHandler } from '@/lib/api';
import { queryClient } from '@/lib/query';
import AppLayout from '@/layouts/AppLayout';

const Login = lazy(() => import('@/features/auth/Login'));
const Register = lazy(() => import('@/features/auth/Register'));
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const Transactions = lazy(() => import('@/features/transactions/TransactionsPage'));
const Expenses = lazy(() => import('@/features/expenses/ExpensesPage'));
const IncomePage = lazy(() => import('@/features/income/IncomePage'));
const Fees = lazy(() => import('@/features/fees/FeesPage'));
const Loans = lazy(() => import('@/features/loans/LoansPage'));
const Budgets = lazy(() => import('@/features/budgets/BudgetsPage'));
const Savings = lazy(() => import('@/features/savings/SavingsPage'));
const Reports = lazy(() => import('@/features/reports/ReportsPage'));
const Settings = lazy(() => import('@/features/settings/SettingsPage'));

const PageFallback = () => (
  <div className="space-y-4 p-6" aria-busy aria-label="Loading">
    <Skeleton className="h-7 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" />
  </div>
);

function RequireAuth() {
  const me = useMe();
  const loc = useLocation();
  if (me.isPending) return <PageFallback />;
  if (me.isError) return <div className="p-8 text-center text-sm text-muted">Can’t reach the server. Check your connection and reload.</div>;
  if (!me.data) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <Outlet />;
}

function PublicOnly() {
  const me = useMe();
  if (me.isPending) return <PageFallback />;
  return me.data ? <Navigate to="/" replace /> : <Outlet />;
}

export default function App() {
  useTheme();
  useEffect(() => {
    // Any 401 from the API means the session is gone: drop cached data and show the login page.
    setUnauthorizedHandler(() => { queryClient.clear(); queryClient.setQueryData(ME_KEY, null); });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="income" element={<IncomePage />} />
              <Route path="fees" element={<Fees />} />
              <Route path="loans" element={<Loans />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="savings" element={<Savings />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
