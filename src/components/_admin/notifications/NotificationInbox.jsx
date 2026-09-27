'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FiBell, FiCheck, FiCreditCard, FiPackage, FiTrash2, FiUser } from 'react-icons/fi';
import * as api from 'src/services';

const typeStyle = {
  order: { icon: FiPackage, className: 'bg-sky-50 text-sky-700' },
  payment: { icon: FiCreditCard, className: 'bg-emerald-50 text-emerald-700' },
  stock: { icon: FiPackage, className: 'bg-amber-50 text-amber-700' },
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
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = (notification) => {
    if (!notification.opened) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.actionUrl) router.push(notification.actionUrl);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="btn-icon relative"
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FiBell size={17} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-semibold leading-none text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-[90] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
              <p className="mt-0.5 text-xs text-slate-500">{unread ? `${unread} unread` : 'You are all caught up'}</p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isLoading}
                className="btn-quiet btn-sm"
              >
                <FiCheck aria-hidden /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[430px] overflow-y-auto">
            {query.isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="skeleton h-16" />
                ))}
              </div>
            ) : query.isError && !notifications.length ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-slate-900">Notifications could not be loaded</p>
                <button type="button" onClick={() => query.refetch()} className="btn-ghost btn-sm mt-3">
                  Try again
                </button>
              </div>
            ) : notifications.length ? (
              notifications.map((notification) => {
                const style = typeStyle[notification.type] || typeStyle.system;
                const Icon = style.icon;
                return (
                  <div
                    key={notification.id}
                    className={`group relative border-b border-slate-100 last:border-0 ${notification.opened ? 'bg-white' : 'bg-slate-50'}`}
                  >
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className="flex w-full gap-3 px-4 py-3.5 pr-11 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${style.className}`}
                      >
                        <Icon size={16} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span
                            className={`line-clamp-1 flex-1 text-sm ${notification.opened ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}
                          >
                            {notification.title}
                          </span>
                          {!notification.opened && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-900">
                              <span className="sr-only">Unread</span>
                            </span>
                          )}
                        </span>
                        {notification.message && (
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500">
                            {notification.message}
                          </span>
                        )}
                        <span className="mt-1 block text-xs font-medium text-slate-500">
                          {relativeTime(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        remove.mutate(notification.id);
                      }}
                      aria-label={`Delete notification: ${notification.title}`}
                      title="Delete"
                      className="absolute right-3 top-3.5 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <FiTrash2 size={14} aria-hidden />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                  <FiBell size={20} aria-hidden />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-900">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-500">New orders and important activity will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
