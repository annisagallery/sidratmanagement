'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FiBell, FiCheck, FiCreditCard, FiPackage, FiTrash2, FiUser } from 'react-icons/fi';
import * as api from 'src/services';

const typeStyle = {
  order: { icon: FiPackage, className: 'bg-blue-50 text-blue-600' },
  payment: { icon: FiCreditCard, className: 'bg-emerald-50 text-emerald-600' },
  stock: { icon: FiPackage, className: 'bg-amber-50 text-amber-600' },
  user: { icon: FiUser, className: 'bg-violet-50 text-violet-600' },
  system: { icon: FiBell, className: 'bg-slate-100 text-slate-600' }
};

function relativeTime(value) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function NotificationInbox() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const query = useQuery(['admin-notifications'], () => api.getNotifications({ limit: 12 }), {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000
  });
  const notifications = query.data?.data || [];
  const unread = query.data?.totalUnread || 0;

  const refresh = () => queryClient.invalidateQueries('admin-notifications');
  const markRead = useMutation(api.markNotificationRead, { onSuccess: refresh });
  const markAll = useMutation(api.markAllNotificationsRead, { onSuccess: refresh });
  const remove = useMutation(api.deleteNotification, { onSuccess: refresh });

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openNotification = (notification) => {
    if (!notification.opened) markRead.mutate(notification._id);
    setOpen(false);
    if (notification.actionUrl) router.push(notification.actionUrl);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <FiBell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-md bg-red-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[90] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_22px_60px_-20px_rgba(15,23,42,0.4)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Notifications</h2>
              <p className="mt-0.5 text-xs text-slate-400">{unread ? `${unread} unread` : 'You are all caught up'}</p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-strong)] hover:underline disabled:opacity-40"
              >
                <FiCheck /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[430px] overflow-y-auto">
            {query.isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-md bg-slate-100" />
                ))}
              </div>
            ) : notifications.length ? (
              notifications.map((notification) => {
                const style = typeStyle[notification.type] || typeStyle.system;
                const Icon = style.icon;
                return (
                  <div
                    key={notification._id}
                    className={`group relative border-b border-slate-100 last:border-0 ${notification.opened ? 'bg-white' : 'bg-blue-50/40'}`}
                  >
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className="flex w-full gap-3 px-4 py-3.5 pr-11 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${style.className}`}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span
                            className={`line-clamp-1 flex-1 text-sm ${notification.opened ? 'font-semibold text-slate-700' : 'font-bold text-slate-950'}`}
                          >
                            {notification.title}
                          </span>
                          {!notification.opened && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-md bg-blue-500" />
                          )}
                        </span>
                        {notification.message && (
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">
                            {notification.message}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] font-medium text-slate-400">
                          {relativeTime(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        remove.mutate(notification._id);
                      }}
                      aria-label="Delete notification"
                      className="absolute right-3 top-4 hidden h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:flex focus:flex"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                  <FiBell size={20} />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-400">New orders and important activity will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
