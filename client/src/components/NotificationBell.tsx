import clsx from 'clsx';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/Button';
import { api } from '@/services/api';
import { useNotifications, useSave } from '@/services/queries';
import { formatDate } from '@/utils/date';
import { useDateFormat } from '@/hooks/useUser';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useNotifications();
  const fmt = useDateFormat();
  const read = useSave((id: string) => api.post(`/notifications/${id}/read`));
  const readAll = useSave(() => api.post('/notifications/read-all'));
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const unread = data?.unreadCount ?? 0;
  return (
    <div ref={ref} className="relative">
      <IconButton label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Bell className="size-[18px]" />
        {unread > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-bg" />}
      </IconButton>
      {open && (
        <div role="region" aria-label="Notifications" className="cl-pop fixed inset-x-3 top-14 z-40 rounded-md border bg-bg shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unread > 0 && <button onClick={() => readAll.mutate(undefined)} className="text-[13px] font-medium text-accent underline underline-offset-4">Mark all as read</button>}
          </div>
          <ul className="max-h-[60dvh] divide-y overflow-y-auto">
            {data?.items.length ? data.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => !n.read && read.mutate(n.id)} className={clsx('block w-full px-4 py-3 text-left hover:bg-surface', n.read && 'opacity-60')}>
                  <span className="flex items-center gap-2 text-sm font-medium">{!n.read && <span aria-label="Unread" className="size-1.5 rounded-full bg-accent" />}{n.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{n.message}</span>
                  <span className="mt-1 block text-xs text-muted">{formatDate(n.createdAt, fmt)}</span>
                </button>
              </li>
            )) : <li className="px-4 py-8 text-center text-[13px] text-muted">You are all caught up. Fee deadlines, repayments and budget warnings show up here.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
