'use client';

export default function Pagination({ page, totalPages, onPage, total, unit = 'items', pageSize = 20 }) {
  if (!totalPages || totalPages <= 0) return null;

  const windowSize = 7;
  const start = Math.max(1, Math.min(page - 3, totalPages - windowSize + 1));
  const pages = Array.from({ length: Math.min(totalPages, windowSize) }, (_, index) => start + index).filter(
    (value) => value >= 1 && value <= totalPages
  );
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = typeof total === 'number' ? Math.min(page * pageSize, total) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="text-xs tabular-nums text-slate-500">
        {typeof total === 'number' ? `${from}–${to} of ${total} ${unit}` : `Page ${page} of ${totalPages}`}
      </p>
      {totalPages > 1 && (
        <div className="flex gap-1">
          <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            Prev
          </button>
          {pages.map((value) => {
            const active = value === page;
            return (
              <button key={value} type="button" onClick={() => onPage(value)} className={`min-w-8 rounded-md border px-2 py-1.5 text-xs tabular-nums transition ${active ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} style={active ? { backgroundColor: 'var(--brand)' } : undefined} aria-current={active ? 'page' : undefined}>
                {value}
              </button>
            );
          })}
          <button type="button" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
