'use client';

import { MdInbox } from 'react-icons/md';

export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-3.5 animate-pulse rounded-md bg-slate-100"
              style={{ width: c === 0 ? '28%' : `${12 + (c % 3) * 6}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', hint, icon: Icon = MdInbox }) {
  return (
    <div className="px-6 py-16 text-center text-slate-400">
      <Icon size={44} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium text-slate-500">{title}</p>
      {hint && <p className="mt-1 text-sm">{hint}</p>}
    </div>
  );
}
