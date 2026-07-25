'use client';

import { useState } from 'react';
import { useQueryClient } from 'react-query';
import { MdFilterAltOff, MdRefresh, MdSearch } from 'react-icons/md';

/**
 * Standard list toolbar: a search box, an arbitrary set of filter controls, and a reset action.
 *
 * Props:
 *  - search, onSearchChange, onSubmit  — controlled search field
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="card-ui flex flex-wrap items-center gap-2 p-3"
    >
      {onSearchChange && (
        <div className="relative min-w-[200px] flex-1">
          <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="input-ui pl-9"
          />
        </div>
      )}

      {children}

      {onSubmit && (
        <button type="submit" className="btn-brand">
          Search
        </button>
      )}
      {onReset && (
        <button type="button" onClick={onReset} className="btn-icon" title="Reset filters">
          <MdFilterAltOff size={18} />
        </button>
      )}

      <button type="button" onClick={handleRefresh} disabled={busy} className="btn-icon" title="Refresh data" aria-label="Refresh data">
        <MdRefresh size={18} className={busy ? 'animate-spin' : ''} />
      </button>

      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </form>
  );
}
