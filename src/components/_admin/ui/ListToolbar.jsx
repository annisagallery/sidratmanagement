'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from 'react-query';
import { MdClose, MdFilterAltOff, MdRefresh, MdSearch } from 'react-icons/md';

/**
 * Standard list toolbar: a search box, an arbitrary set of filter controls, and a reset action.
 *
 * Props:
 *  - search, onSearchChange, onSubmit  — controlled search field. The search
 *    applies itself a moment after typing stops (it calls `onSubmit`, exactly
 *    what the old Search button did), or at once on Enter.
 *  - searchPlaceholder
 *  - onReset                           — clears filters (shows the reset button when provided)
 *  - children                          — filter <select> elements (use the `select-ui` class)
 *  - right                             — optional right-aligned slot (extra actions)
 */
export default function ListToolbar({
  search,
  onSearchChange,
  onSubmit,
  searchPlaceholder = 'Search…',
  onReset,
  onRefresh,
  refreshing = false,
  children,
  right
}) {
  const queryClient = useQueryClient();
  const [refreshingAll, setRefreshingAll] = useState(false);
  const handleRefresh = async () => {
    if (onRefresh) return onRefresh();
    setRefreshingAll(true);
    try {
      await queryClient.refetchQueries();
    } finally {
      setRefreshingAll(false);
    }
  };
  const busy = refreshing || refreshingAll;

  // Always call the latest onSubmit — it closes over the caller's current state.
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return undefined;
    }
    if (!onSearchChange || !submitRef.current) return undefined;
    const timer = setTimeout(() => submitRef.current?.(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      {onSearchChange && (
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && search) {
                e.stopPropagation();
                onSearchChange('');
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder.replace(/…$/, '')}
            className="input-ui pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <MdClose size={16} />
            </button>
          ) : null}
        </div>
      )}

      {children}

      {/* Enter still submits; the visible button is no longer needed. */}
      {onSubmit && <button type="submit" className="sr-only">Search</button>}
      {onReset && (
        <button type="button" onClick={onReset} className="btn-quiet btn-sm" title="Clear all filters">
          <MdFilterAltOff size={16} aria-hidden /> Clear filters
        </button>
      )}

      <button
        type="button"
        onClick={handleRefresh}
        disabled={busy}
        className="btn-icon"
        title="Refresh data"
        aria-label="Refresh data"
      >
        <MdRefresh size={18} className={busy ? 'animate-spin' : ''} />
      </button>

      {right && <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>}
    </form>
  );
}
