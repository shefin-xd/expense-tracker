import clsx from 'clsx';
import { LogOut, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { QuickAddHost } from '@/features/transactions/QuickAdd';
import { useLogout, useUser } from '@/hooks/useAuth';
import { useUi } from '@/store/ui';
import { NAV, PRIMARY_MOBILE } from './nav';

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary dark:border dark:border-strong">
      <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden><path d="M9 9h14M9 16h14M9 23h8" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>
    </div>
    <span className="text-[15px] font-semibold tracking-tight">CampusLedger</span>
  </div>
);

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx('flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-subtle text-fg' : 'text-muted hover:bg-subtle hover:text-fg');

export default function AppLayout() {
  const user = useUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const loc = useLocation();
  const openQuick = useUi((s) => s.openQuick);
  const setTheme = useUi((s) => s.setTheme);
  const [more, setMore] = useState(false);

  // Adopt the theme saved on the account when a session starts.
  useEffect(() => { if (user.preferences?.theme) setTheme(user.preferences.theme); }, [user.id, user.preferences?.theme, setTheme]);
  useEffect(() => { setMore(false); }, [loc.pathname]);

  const signOut = () => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  const mobilePrimary = NAV.filter((n) => PRIMARY_MOBILE.includes(n.to));
  const mobileMore = NAV.filter((n) => !PRIMARY_MOBILE.includes(n.to));
  const moreActive = mobileMore.some((n) => loc.pathname.startsWith(n.to));

  return (
    <div className="min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 py-5"><Logo /></div>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}><n.icon className="h-4 w-4" aria-hidden />{n.label}</NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-muted transition-colors hover:bg-subtle hover:text-fg">
            <LogOut className="h-4 w-4" aria-hidden />Sign out
          </button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur md:justify-end md:px-8">
          <div className="md:hidden"><Logo /></div>
          <div className="flex items-center gap-1.5">
            <NotificationsBell />
            <Button size="sm" className="hidden md:inline-flex" onClick={() => openQuick({ type: 'expense' })}><Plus className="h-4 w-4" />Add</Button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8"><Outlet /></main>
      </div>

      {/* Phone bottom bar */}
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
        <div className="grid h-14 grid-cols-5 items-center">
          {mobilePrimary.slice(0, 2).map((n) => <MobileTab key={n.to} item={n} />)}
          <div className="flex justify-center">
            <button aria-label="Add transaction" onClick={() => openQuick({ type: 'expense' })}
              className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-fg shadow-pop dark:border dark:border-strong">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {mobilePrimary.slice(2).map((n) => <MobileTab key={n.to} item={n} />)}
          <button onClick={() => setMore(true)} aria-label="More" className={clsx('flex flex-col items-center gap-0.5 text-[11px] font-medium', moreActive ? 'text-fg' : 'text-muted')}>
            <MoreHorizontal className="h-5 w-5" aria-hidden />More
          </button>
        </div>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="More">
        <nav aria-label="More" className="-mx-2 space-y-0.5">
          {mobileMore.map((n) => <NavLink key={n.to} to={n.to} className={linkClass}><n.icon className="h-4 w-4" aria-hidden />{n.label}</NavLink>)}
          <IconlessSignOut onClick={signOut} />
        </nav>
      </Modal>

      <QuickAddHost />
    </div>
  );
}

function MobileTab({ item }: { item: (typeof NAV)[number] }) {
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 text-[11px] font-medium', isActive ? 'text-fg' : 'text-muted')}>
      <item.icon className="h-5 w-5" aria-hidden />{item.label.split(' ')[0]}
    </NavLink>
  );
}

function IconlessSignOut({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-2 flex w-full items-center gap-3 rounded border-t border-line px-3 py-3 text-sm text-muted hover:bg-subtle hover:text-fg">
      <LogOut className="h-4 w-4" aria-hidden />Sign out
    </button>
  );
}

