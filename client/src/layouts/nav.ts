import { ArrowLeftRight, FileText, GraduationCap, HandCoins, LayoutDashboard, PiggyBank, Receipt, Settings, Target, Users, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/income', label: 'Income', icon: HandCoins },
  { to: '/fees', label: 'Fees & Payments', icon: GraduationCap },
  { to: '/loans', label: 'Borrow & Lend', icon: Users },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/reports', label: 'Reports & Exports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];
/** Shown in the phone bottom bar; everything else sits behind "More". */
export const PRIMARY_MOBILE = ['/', '/transactions', '/fees'];
