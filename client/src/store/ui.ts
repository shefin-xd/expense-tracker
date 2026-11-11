import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PaymentMethod, Theme } from '@/lib/types';

export type QuickModal =
  | { type: 'expense' }
  | { type: 'income'; source?: 'parents' }
  | { type: 'fee' }
  | null;

interface UiState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  // Remembered between sessions so adding an expense takes fewer taps.
  lastCategory: string;
  lastMethod: PaymentMethod;
  remember: (p: { category?: string; method?: PaymentMethod }) => void;
  quick: QuickModal;
  openQuick: (m: Exclude<QuickModal, null>) => void;
  closeQuick: () => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      lastCategory: 'Food',
      lastMethod: 'upi',
      remember: (p) => set((s) => ({ lastCategory: p.category ?? s.lastCategory, lastMethod: p.method ?? s.lastMethod })),
      quick: null,
      openQuick: (quick) => set({ quick }),
      closeQuick: () => set({ quick: null }),
    }),
    { name: 'cl-ui', partialize: (s) => ({ theme: s.theme, lastCategory: s.lastCategory, lastMethod: s.lastMethod }) },
  ),
);
