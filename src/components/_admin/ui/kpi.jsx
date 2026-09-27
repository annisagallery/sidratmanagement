'use client';
import Link from 'next/link';
import { MdArrowUpward, MdArrowDownward, MdRemove } from 'react-icons/md';

/** Percentage change from `previous` to `current`; null when there is no base. */
function change(current, previous) {
  const base = Number(previous || 0);
  if (!base) return null;
  return ((Number(current || 0) - base) / base) * 100;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

/**
 * A band of figures sharing one surface, split by hairlines — reads as one
 * summary rather than a row of separate cards. Put `StatTile`s inside.
 */
export function KpiGrid({ children, columns = 4, className = '' }) {
  const cols =
    { 2: 'grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[columns] || 'grid-cols-2 lg:grid-cols-4';
  return (
    <div
      className={`grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${cols} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * label · value · change vs the previous period of the same length.
 * `upIsGood=false` flips the colour for measures like cancellation rate.
 * `size="sm"` is the secondary tier: same content, less emphasis.
 */
export function StatTile({
  label,
  value,
  current,
  previous,
  upIsGood = true,
  hint,
  deltaMode = 'pct',
  loading = false,
  size = 'lg',
  title,
}) {
  let delta = null;
  if (previous !== undefined) {
    delta = deltaMode === 'points' ? Number(current || 0) - Number(previous || 0) : change(current, previous);
  }
  const flat = delta === null || Math.abs(delta) < 0.05;
  const good = !flat && (delta > 0) === upIsGood;
  const Icon = flat ? MdRemove : delta > 0 ? MdArrowUpward : MdArrowDownward;
  const amount = delta === null ? '' : deltaMode === 'points' ? `${Math.abs(delta).toFixed(1)} pts` : `${Math.abs(delta).toFixed(1)}%`;
  const direction = flat ? 'No change' : delta > 0 ? 'Up' : 'Down';
  const large = size === 'lg';

  return (
    <div className={`flex min-w-0 flex-col bg-white ${large ? 'gap-1 p-5' : 'gap-0.5 px-5 py-4'}`}>
      <p className={`truncate font-medium text-slate-500 ${large ? 'text-[13px]' : 'text-xs'}`}>{label}</p>
      {loading ? (
        <span className={`skeleton my-1 ${large ? 'h-7 w-28' : 'h-5 w-20'}`} />
      ) : (
        <p
          className={`truncate font-semibold tabular-nums tracking-tight text-slate-900 ${large ? 'text-[26px] leading-9' : 'text-lg'}`}
          title={title}
        >
          {value}
        </p>
      )}
      <div className="flex min-h-[20px] flex-wrap items-center gap-x-1.5 text-xs">
        {!loading && previous !== undefined &&
          (delta === null ? (
            <span className="text-slate-500">No data for the previous period</span>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-0.5 rounded px-1 py-px font-semibold tabular-nums ${
                  flat ? 'bg-slate-100 text-slate-600' : good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                <Icon size={13} aria-hidden />
                <span className="sr-only">{direction} </span>
                {amount}
              </span>
              <span className="text-slate-500">vs previous period</span>
            </>
          ))}
        {hint && previous === undefined && <span className="text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}

/**
 * A StatTile that opens the list behind the number. Same look inside a
 * KpiGrid, with a hover state.
 */
export function LinkTile({ href, ...props }) {
  return (
    <Link href={href} className="group relative block min-w-0 bg-white transition-colors hover:bg-slate-50 [&>div]:bg-transparent">
      <StatTile {...props} />
    </Link>
  );
}
