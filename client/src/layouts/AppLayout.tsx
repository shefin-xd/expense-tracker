import clsx from 'clsx';
import {
  ArrowLeftRight, CreditCard, FileText, HandCoins, LayoutDashboard, LogOut, MoreHorizontal, Monitor, Moon, PiggyBank, Plus, Receipt,
  Settings, Sun, Target, Wallet,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toaster';
import { QuickAddHost, useQuickAdd } from '@/features/quickadd/QuickAdd';
import { useUser } from '@/hooks/useUser';
import { api } from '@/services/api';
import { applyTheme, useThemeStore } from '@/store/theme';
import { loginUrl, nav } from '@/utils/auth';
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
  return async () => {
    try { await api.post('/auth/logout'); } catch { /* the cookie may already be gone */ }
    qc.clear();
    nav.go(loginUrl(`${window.location.origin}/`, { signed_out: '1' })); // back to the separate sign-in app
  };
}

function ThemeSync() {
  const user = useUser();
  const { theme, setTheme } = useThemeStore();
  useEffect(() => { if (user.preferences?.theme && user.preferences.theme !== theme) setTheme(user.preferences.theme); /* the saved preference wins on load */ }, [user.preferences?.theme]); // eslint-disable-line react-hooks/exhaustive-deps
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

function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[9px] bg-navy text-white" aria-hidden><svg viewBox="0 0 32 32" className="size-4"><path d="M10 9v14h12" stroke="currentColor" strokeWidth="3.5" fill="none" /></svg></span>
      {!compact && <span className="text-[17px] font-semibold tracking-tight">CampusLedger</span>}
    </span>
  );
}

/** One nav list, shown with labels on desktop and as an icon rail on tablets. */
function SideNav({ compact }: { compact?: boolean }) {
  return (
    <nav aria-label="Main" className={clsx('flex-1 overflow-y-auto', compact ? 'space-y-1.5' : 'space-y-0.5')}>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={'end' in n} title={n.label} aria-label={compact ? n.label : undefined}
          className={({ isActive }) => clsx('flex items-center rounded-[10px] transition-colors', compact ? 'mx-auto size-11 justify-center' : 'h-10 gap-3 px-3 text-[15px]', isActive ? 'bg-accent/12 font-semibold text-accent' : 'text-text/75 active:bg-fill sm:hover:bg-fill')}>
          <n.icon className={compact ? 'size-[22px]' : 'size-5'} aria-hidden />{!compact && n.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const user = useUser();
  const signOut = useSignOut();
  const { theme, setTheme } = useThemeStore();
  const open = useQuickAdd((s) => s.open);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMore(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const ThemeIcon = THEME_ICON[theme];
  const themeLabel = `Theme: ${theme}. Switch to ${THEME_NEXT[theme]}`;

  return (
    <div className="min-h-dvh md:pl-[76px] lg:pl-[272px]">
      <ThemeSync />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-[10px] focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow-card">Skip to content</a>

      {/* Tablet icon rail */}
      <aside className="cl-bar fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col border-r px-2 pb-4 pt-[max(1rem,env(safe-area-inset-top))] md:flex lg:hidden">
        <div className="mb-5 flex justify-center"><Logo compact /></div>
        <SideNav compact />
        <div className="mt-3 flex flex-col items-center gap-1 border-t pt-3">
          <IconButton label={themeLabel} onClick={() => setTheme(THEME_NEXT[theme])}><ThemeIcon className="size-5" /></IconButton>
          <IconButton label="Sign out" onClick={signOut}><LogOut className="size-5" /></IconButton>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="cl-bar fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r px-3 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] lg:flex">
        <div className="px-3 pb-5"><Logo /></div>
        <SideNav />
        <div className="mt-3 border-t pt-3">
          <div className="px-3 pb-2"><p className="truncate text-[15px] font-semibold">{user.name}</p><p className="truncate text-[13px] text-muted">{user.email}</p></div>
          <div className="flex items-center gap-1">
            <button onClick={signOut} className="flex h-10 flex-1 items-center gap-3 rounded-[10px] px-3 text-[15px] text-text/75 active:bg-fill sm:hover:bg-fill"><LogOut className="size-5" aria-hidden />Sign out</button>
            <IconButton label={themeLabel} onClick={() => setTheme(THEME_NEXT[theme])}><ThemeIcon className="size-5" /></IconButton>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="cl-bar sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-[52px] max-w-5xl items-center justify-between px-4 lg:px-8">
          <div className="md:hidden"><Logo /></div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <div className="hidden items-center gap-2 md:flex">
              <Button size="sm" onClick={() => open('expense')}><Plus className="size-4" aria-hidden />Add expense</Button>
              <Button size="sm" variant="secondary" onClick={() => open('menu')}>More actions</Button>
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:pt-6 md:pb-12 lg:px-8 lg:pt-8">
        <Suspense fallback={<div role="status" aria-label="Loading" className="space-y-4"><Skeleton className="h-9 w-56" /><Skeleton className="h-32 w-full !rounded-2xl" /><Skeleton className="h-64 w-full !rounded-2xl" /></div>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Phone tab bar */}
      <nav aria-label="Main" className="cl-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t pb-[env(safe-area-inset-bottom)] md:hidden">
        <MobileLink to="/" end icon={LayoutDashboard} label="Home" />
        <MobileLink to="/transactions" icon={ArrowLeftRight} label="History" />
        <button onClick={() => open('expense')} aria-label="Add expense" className="mx-auto my-1.5 grid size-12 place-items-center rounded-full bg-accent text-white shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_45%,transparent)] transition-transform active:scale-95"><Plus className="size-6" strokeWidth={2.6} aria-hidden /></button>
        <MobileLink to="/fees" icon={CreditCard} label="Fees" />
        <button onClick={() => setMore(true)} className="flex h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted"><MoreHorizontal className="size-[26px]" aria-hidden />More</button>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="Menu">
        <ul className="divide-y overflow-hidden rounded-2xl bg-surface">
          {NAV.filter((n) => !['/', '/transactions', '/fees'].includes(n.to)).map((n) => (
            <li key={n.to}><NavLink to={n.to} className="flex items-center gap-3 px-4 py-3.5 text-[16px] active:bg-fill"><n.icon className="size-5 text-accent" aria-hidden />{n.label}</NavLink></li>
          ))}
          <li><button onClick={() => open('menu')} className="flex w-full items-center gap-3 px-4 py-3.5 text-[16px] active:bg-fill"><Plus className="size-5 text-accent" aria-hidden />More add options</button></li>
          <li><button onClick={() => setTheme(THEME_NEXT[theme])} className="flex w-full items-center gap-3 px-4 py-3.5 text-[16px] active:bg-fill"><ThemeIcon className="size-5 text-accent" aria-hidden />Theme: {theme}</button></li>
          <li><button onClick={signOut} className="flex w-full items-center gap-3 px-4 py-3.5 text-[16px] text-danger active:bg-fill"><LogOut className="size-5" aria-hidden />Sign out</button></li>
        </ul>
      </Modal>

      <QuickAddHost />
      <Toaster />
    </div>
  );
}

function MobileLink({ to, icon: Icon, label, end }: { to: string; icon: typeof Sun; label: string; end?: boolean }) {
  return (
    <NavLink to={to} {...(end ? { end } : {})} className={({ isActive }) => clsx('flex h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium', isActive ? 'text-accent' : 'text-muted')}>
      <Icon className="size-[26px]" aria-hidden />{label}
    </NavLink>
  );
}
