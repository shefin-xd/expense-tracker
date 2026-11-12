import clsx from 'clsx';
import {
  ArrowLeftRight, CreditCard, FileText, HandCoins, LayoutDashboard, LogOut, MoreHorizontal, Monitor, Moon, PiggyBank, Plus, Receipt,
  Settings, Sun, Target, Wallet,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toaster';
import { QuickAddHost, useQuickAdd } from '@/features/quickadd/QuickAdd';
import { useUser } from '@/hooks/useUser';
import { api } from '@/services/api';
import { toast } from '@/store/toast';
import { applyTheme, useThemeStore } from '@/store/theme';
import { useQueryClient } from '@tanstack/react-query';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/income', label: 'Income', icon: Wallet },
  { to: '/fees', label: 'Fees & Payments', icon: CreditCard },
  { to: '/borrow-lend', label: 'Borrow & Lend', icon: HandCoins },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/reports', label: 'Reports & Exports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

function useSignOut() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return async () => {
    try { await api.post('/auth/logout'); } catch { /* the cookie may already be gone */ }
    qc.clear();
    nav('/login', { replace: true });
    toast.success('Signed out');
  };
}

function ThemeSync() {
  const user = useUser();
  const { theme, setTheme } = useThemeStore();
  useEffect(() => { if (user.preferences?.theme && user.preferences.theme !== theme) setTheme(user.preferences.theme); /* server preference wins on load */ }, [user.preferences?.theme]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);
  return null;
}

const THEME_NEXT = { light: 'dark', dark: 'system', system: 'light' } as const;
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const;

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-7 place-items-center rounded-md bg-navy text-white" aria-hidden><svg viewBox="0 0 32 32" className="size-4"><path d="M10 9v14h12" stroke="currentColor" strokeWidth="3.5" fill="none" /></svg></span>
      <span className="text-[15px] font-semibold tracking-tight">CampusLedger</span>
    </span>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx('flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors', isActive ? 'bg-navy font-medium text-white' : 'text-muted hover:bg-surface hover:text-text');

export function AppLayout() {
  const user = useUser();
  const signOut = useSignOut();
  const { theme, setTheme } = useThemeStore();
  const open = useQuickAdd((s) => s.open);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMore(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const ThemeIcon = THEME_ICON[theme];

  return (
    <div className="min-h-dvh lg:pl-60">
      <ThemeSync />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-bg focus:px-3 focus:py-2 focus:text-sm focus:shadow-md">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-bg px-3 py-4 lg:flex">
        <div className="px-3 pb-5 pt-1"><Logo /></div>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={'end' in n} className={linkClass}><n.icon className="size-4" aria-hidden />{n.label}</NavLink>)}
        </nav>
        <div className="mt-3 border-t pt-3">
          <div className="px-3 pb-2"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted">{user.email}</p></div>
          <div className="flex items-center gap-1">
            <button onClick={signOut} className="flex h-9 flex-1 items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-surface hover:text-text"><LogOut className="size-4" aria-hidden />Sign out</button>
            <IconButton label={`Theme: ${theme}. Switch to ${THEME_NEXT[theme]}`} onClick={() => setTheme(THEME_NEXT[theme])}><ThemeIcon className="size-4" /></IconButton>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-bg/95 px-4 backdrop-blur lg:px-8">
        <div className="lg:hidden"><Logo /></div>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <div className="hidden items-center gap-1.5 lg:flex">
            <Button size="sm" onClick={() => open('expense')}><Plus className="size-4" aria-hidden />Add expense</Button>
            <Button size="sm" variant="secondary" onClick={() => open('menu')}>More actions</Button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12 lg:pt-8">
        <Suspense fallback={<div role="status" aria-label="Loading" className="space-y-4"><Skeleton className="h-7 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <MobileLink to="/" end icon={LayoutDashboard} label="Home" />
        <MobileLink to="/transactions" icon={ArrowLeftRight} label="History" />
        <button onClick={() => open('expense')} aria-label="Add expense" className="mx-auto my-1.5 grid size-11 place-items-center rounded-md bg-primary text-primary-fg"><Plus className="size-5" aria-hidden /></button>
        <MobileLink to="/fees" icon={CreditCard} label="Fees" />
        <button onClick={() => setMore(true)} className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted"><MoreHorizontal className="size-5" aria-hidden />More</button>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="Menu">
        <ul className="-my-2 divide-y">
          {NAV.filter((n) => !['/', '/transactions', '/fees'].includes(n.to)).map((n) => (
            <li key={n.to}><NavLink to={n.to} className="flex items-center gap-3 py-3 text-sm"><n.icon className="size-4 text-muted" aria-hidden />{n.label}</NavLink></li>
          ))}
          <li><button onClick={() => open('menu')} className="flex w-full items-center gap-3 py-3 text-sm"><Plus className="size-4 text-muted" aria-hidden />More add options</button></li>
          <li><button onClick={() => setTheme(THEME_NEXT[theme])} className="flex w-full items-center gap-3 py-3 text-sm"><ThemeIcon className="size-4 text-muted" aria-hidden />Theme: {theme}</button></li>
          <li><button onClick={signOut} className="flex w-full items-center gap-3 py-3 text-sm"><LogOut className="size-4 text-muted" aria-hidden />Sign out</button></li>
        </ul>
      </Modal>

      <QuickAddHost />
      <Toaster />
    </div>
  );
}

function MobileLink({ to, icon: Icon, label, end }: { to: string; icon: typeof Sun; label: string; end?: boolean }) {
  return (
    <NavLink to={to} {...(end ? { end } : {})} className={({ isActive }) => clsx('flex h-14 flex-col items-center justify-center gap-1 text-[11px]', isActive ? 'font-semibold text-text' : 'text-muted')}>
      <Icon className="size-5" aria-hidden />{label}
    </NavLink>
  );
}
