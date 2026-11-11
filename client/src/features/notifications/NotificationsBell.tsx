import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, Download, PiggyBank, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/Button';
import { Button } from '@/components/ui/Button';
import { EmptyState, ListSkeleton } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { queryClient } from '@/lib/query';
import { useDateFormat } from '@/hooks/useAuth';
import type { AppNotification } from '@/lib/types';

const KEY = ['notifications'];
const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
const icons: Record<string, typeof Bell> = { fee_due_soon: CalendarClock, fee_overdue: TriangleAlert, budget_warning: PiggyBank, repayment_due: CalendarClock, export_ready: Download };

export function NotificationsBell() {
  const fmt = useDateFormat();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<{ items: AppNotification[]; unreadCount: number }>('/notifications'), refetchInterval: 60_000, staleTime: 20_000 });
  const read = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/notifications/${id}`), onSuccess: refresh });
  const unread = q.data?.unreadCount ?? 0;

  return (
    <>
      <div className="relative">
        <IconButton label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={() => setOpen(true)}><Bell className="h-[18px] w-[18px]" /></IconButton>
        {unread > 0 && <span className="num pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-fg ring-2 ring-bg dark:border dark:border-strong">{unread > 9 ? '9+' : unread}</span>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Notifications">
        {q.isPending ? <ListSkeleton rows={3} /> : !q.data?.items.length ? (
          <EmptyState icon={Bell} title="You’re all caught up" description="Fee deadlines, budget warnings and repayment dates will show up here." />
        ) : (
          <>
            {unread > 0 && <div className="mb-2 flex justify-end"><Button variant="ghost" size="sm" onClick={() => readAll.mutate()}>Mark all as read</Button></div>}
            <ul className="-mx-2 divide-y divide-line">
              {q.data.items.map((n) => {
                const Icon = icons[n.type] ?? Bell;
                return (
                  <li key={n.id} className="flex items-start gap-3 px-2 py-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <button onClick={() => !n.read && read.mutate(n.id)} className="min-w-0 flex-1 text-left">
                      <p className="flex items-center gap-2 text-sm font-medium">{n.title}{!n.read && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="Unread" />}</p>
                      <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                      <p className="mt-1 text-xs text-faint">{formatDate(n.createdAt, fmt)}</p>
                    </button>
                    <IconButton label="Delete notification" onClick={() => remove.mutate(n.id)}><Trash2 className="h-4 w-4" /></IconButton>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Modal>
    </>
  );
}
