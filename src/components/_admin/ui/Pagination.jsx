'use client';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

/** Page numbers to show: always the first and last, a window around the current one, gaps as null. */
function pageList(page, totalPages) {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => wanted.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => wanted.add(p));
  const sorted = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, totalPages, onPage, total, unit = 'items', pageSize = 20 }) {
  if (!totalPages || totalPages <= 0) return null;

  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = typeof total === 'number' ? Math.min(page * pageSize, total) : null;
  const pages = pageList(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3"
    >
      <p className="text-[13px] tabular-nums text-slate-500">
        {typeof total === 'number' ? (
          <>
            <span className="font-medium text-slate-700">{from.toLocaleString()}–{to.toLocaleString()}</span> of{' '}
            <span className="font-medium text-slate-700">{total.toLocaleString()}</span> {unit}
          </>
        ) : (
          `Page ${page} of ${totalPages}`
        )}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="btn-icon btn-icon-sm"
            aria-label="Previous page"
          >
            <MdChevronLeft size={20} />
          </button>
          <div className="hidden items-center gap-1 sm:flex">
            {pages.map((value, index) =>
              value === null ? (
                <span key={`gap-${index}`} className="w-6 text-center text-slate-400" aria-hidden>
                  …
                </span>
              ) : (
                <button
                  key={value}
                  type="button"
                  onClick={() => onPage(value)}
                  aria-current={value === page ? 'page' : undefined}
                  aria-label={`Page ${value}`}
                  className={`h-8 min-w-8 rounded-md px-2 text-[13px] font-medium tabular-nums transition-colors ${
                    value === page ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {value}
                </button>
              ),
            )}
          </div>
          <span className="px-2 text-[13px] tabular-nums text-slate-600 sm:hidden">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="btn-icon btn-icon-sm"
            aria-label="Next page"
          >
            <MdChevronRight size={20} />
          </button>
        </div>
      )}
    </nav>
  );
}
