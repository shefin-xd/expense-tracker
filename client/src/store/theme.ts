import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '@/types/api';

interface ThemeState { theme: Theme; setTheme: (t: Theme) => void }

export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ theme: 'system', setTheme: (theme) => set({ theme }) }), { name: 'cl-theme' }),
);

export const isDark = (t: Theme) => t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

/** Keeps the <html> class in sync with the chosen theme, including live OS changes in "system" mode. */
export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', isDark(t));
}
