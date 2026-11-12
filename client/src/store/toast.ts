import { create } from 'zustand';

export interface ToastItem { id: number; kind: 'success' | 'error'; message: string }
interface ToastState { toasts: ToastItem[]; push: (kind: ToastItem['kind'], message: string) => void; dismiss: (id: number) => void }

let seq = 0;
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }));
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
};
