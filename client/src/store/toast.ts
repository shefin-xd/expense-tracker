import { create } from 'zustand';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }
let next = 1;
export const useToasts = create<{ toasts: Toast[]; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function push(kind: Toast['kind'], message: string) {
  const id = next++;
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }));
  setTimeout(() => useToasts.getState().dismiss(id), kind === 'error' ? 6000 : 3500);
}
export const toast = {
  success: (m: string) => push('success', m),
  error: (m: string) => push('error', m),
  info: (m: string) => push('info', m),
};
