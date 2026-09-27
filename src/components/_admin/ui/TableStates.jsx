'use client';

import { MdInbox, MdErrorOutline, MdRefresh } from 'react-icons/md';
import { apiMessage } from 'src/utils/swal';
import { SHOW_PAGE_GUIDANCE } from './primitives';

export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="divide-y divide-slate-100" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 px-4 py-4">
          {Array.from({ length: Math.min(cols, 6) }).map((_, c) => (
            <div key={c} className="skeleton h-3" style={{ width: c === 0 ? '28%' : `${10 + (c % 3) * 5}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Nothing to show. Say why, and when there is one, offer the next step as
 * `action`. Hints follow SHOW_PAGE_GUIDANCE like the rest of the page help.
 */
export function EmptyState({ title = 'Nothing here yet', hint, icon: Icon = MdInbox, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center px-6 text-center ${compact ? 'py-10' : 'py-16'}`}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={24} aria-hidden />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {hint && SHOW_PAGE_GUIDANCE && <p className="mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A load failed. Shows the server's reason and a way to try again. */
export function ErrorState({ error, title = 'This could not be loaded', onRetry, className = '' }) {
  return (
    <div className={`card-ui flex flex-col items-center px-6 py-12 text-center ${className}`} role="alert">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <MdErrorOutline size={24} aria-hidden />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">{apiMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn-ghost btn-sm mt-5" onClick={() => onRetry()}>
          <MdRefresh size={16} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

/** Placeholder for a section or page whose data is still loading. */
export function LoadingBlock({ rows = 4, bare = false }) {
  const body = <TableSkeleton rows={rows} cols={3} />;
  return bare ? body : <div className="card-ui overflow-hidden">{body}</div>;
}
