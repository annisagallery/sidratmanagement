'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MdClose, MdContentCopy, MdDownload } from 'react-icons/md';

import { alertBulkResult, toastSuccess } from 'src/utils/swal';
import { describeRow, runBulk } from 'src/utils/bulk';

/**
 * Page-aware bulk selection, and the bar that acts on it.
 *
 * This lived inside DataTable, which was fine until a second table needed it.
 * The orders list has two views — a summary built on DataTable and a detailed
 * one built by hand, because its rows span multiple lines per order and a
 * generic table cannot express that. Only the first could select anything, so
 * switching to the view that shows you the most silently took away your ability
 * to act on it.
 *
 * Copying the bar into the second table was the obvious fix and the wrong one:
 * these buttons delete orders and change their status in bulk, and two
 * implementations of that drift. So the machinery moved here and both tables
 * call it.
 */

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const safeCellValue = (column, row) => {
  const value = column.exportValue ? column.exportValue(row) : row?.[column.key];
  if (value == null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

const TONE_CLASS = {
  danger: 'border-rose-200 text-rose-700 hover:bg-rose-50 focus:ring-rose-400',
  warning: 'border-amber-200 text-amber-800 hover:bg-amber-50 focus:ring-amber-400',
  success: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-400',
  neutral: 'border-slate-200 text-slate-700 hover:bg-slate-100 focus:ring-[var(--brand-ring)]'
};

const barButton = (tone) =>
  `inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
    TONE_CLASS[tone] || TONE_CLASS.neutral
  }`;

export function SelectionCheckbox({ checked, indeterminate = false, label, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] focus:ring-offset-1"
    />
  );
}

/**
 * Selection that survives paging.
 *
 * Keyed by row key rather than index, and the row itself is kept, so a
 * selection made on page 1 is still actionable after paging to page 3 — the
 * bar says how many are off-page so nobody acts on more than they think.
 */
export function useBulkSelection({ data, rowKey }) {
  const [selected, setSelected] = useState(() => new Map());

  const pageRows = useMemo(() => data.map((row, i) => [String(rowKey(row, i)), row]), [data, rowKey]);
  const selectedRows = useMemo(() => Array.from(selected.values()), [selected]);
  const selectedOnPage = pageRows.filter(([key]) => selected.has(key)).length;
  const allPageSelected = pageRows.length > 0 && selectedOnPage === pageRows.length;

  const clearSelection = () => setSelected(new Map());

  const togglePage = () =>
    setSelected((current) => {
      const next = new Map(current);
      if (allPageSelected) pageRows.forEach(([key]) => next.delete(key));
      else pageRows.forEach(([key, row]) => next.set(key, row));
      return next;
    });

  const toggleRow = (key, row) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else next.set(key, row);
      return next;
    });

  return {
    selected,
    selectedRows,
    selectedOnPage,
    allPageSelected,
    offPageCount: selectedRows.length - selectedOnPage,
    isSelected: (key) => selected.has(key),
    toggleRow,
    togglePage,
    clearSelection
  };
}

/**
 * The bar that appears once something is selected.
 *
 * Owns the parts every list got subtly different when it rolled its own:
 * running the rows one at a time, showing progress, reporting partial success,
 * and clearing the selection only when something actually changed.
 */
export function BulkActionBar({
  selectedRows,
  offPageCount = 0,
  clearSelection,
  bulkActions = [],
  columns = [],
  selectionLabel = 'rows',
  exportFileName = 'selected-rows.csv'
}) {
  const [running, setRunning] = useState(null);
  if (!selectedRows.length) return null;

  const busy = Boolean(running);

  const copyIdentifiers = async () => {
    const ids = selectedRows.map((row, i) => row?.orderNo ?? row?.id ?? i + 1).join('\n');
    await navigator.clipboard.writeText(ids);
    toastSuccess(`${selectedRows.length} identifier${selectedRows.length === 1 ? '' : 's'} copied`);
  };

  const exportSelected = () => {
    const exportColumns = columns.filter((column) => column.exportable !== false && column.key !== 'actions');
    const csv = [
      exportColumns.map((column) => csvCell(column.label || column.key)).join(','),
      ...selectedRows.map((row) => exportColumns.map((column) => csvCell(safeCellValue(column, row))).join(','))
    ].join('\r\n');
    // Leading BOM so Excel opens the file as UTF-8 rather than mangling Bangla.
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName;
    link.click();
    URL.revokeObjectURL(url);
    toastSuccess(`${selectedRows.length} ${selectionLabel} exported`, exportFileName);
  };

  const invoke = async (action) => {
    const rows = selectedRows;
    if (action.confirm && !(await action.confirm(rows))) return;

    setRunning({ label: action.label, done: 0, total: rows.length });
    try {
      if (!action.perform) {
        // Whole-selection action: it owns its own messaging and tells us
        // whether the selection is still meaningful afterwards.
        const outcome = await action.onClick(rows);
        if (outcome !== false && action.clearOnSuccess !== false) clearSelection();
        return;
      }

      const { succeeded, failures } = await runBulk(rows, action.perform, {
        rowLabel: action.rowLabel || describeRow,
        onProgress: (done, total) => setRunning({ label: action.label, done, total })
      });

      await alertBulkResult({
        action: action.action || 'Updated',
        unit: action.unit || selectionLabel,
        succeeded,
        failures
      });
      if (succeeded && action.clearOnSuccess !== false) clearSelection();
    } finally {
      setRunning(null);
      action.onSettled?.();
    }
  };

  return (
    <div
      className="flex min-h-12 flex-wrap items-center gap-2 border-b border-[var(--brand)]/40 bg-[var(--brand-soft)] px-3 py-2"
      role="region"
      aria-label="Bulk actions"
    >
      <span className="mr-1 text-sm font-semibold text-slate-900">
        {selectedRows.length} {selectionLabel} selected
        {offPageCount > 0 && <span className="ml-1 font-normal text-slate-500">({offPageCount} on other pages)</span>}
      </span>

      {columns.length > 0 && (
        <button type="button" onClick={exportSelected} disabled={busy} className={barButton('neutral')}>
          <MdDownload size={17} /> Export CSV
        </button>
      )}
      <button type="button" onClick={copyIdentifiers} disabled={busy} className={barButton('neutral')}>
        <MdContentCopy size={16} /> Copy IDs
      </button>

      {bulkActions.length > 0 && <span className="mx-1 h-6 w-px bg-[var(--brand)]/30" aria-hidden="true" />}

      {bulkActions.map((action) => {
        const Icon = action.icon;
        const isRunning = running?.label === action.label;
        const disabled = busy || action.disabled?.(selectedRows) === true;
        return (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            title={action.hint}
            onClick={() => invoke(action)}
            className={barButton(action.tone)}
          >
            {Icon && <Icon size={16} />}
            {isRunning && running.total > 1 ? `${action.label}… ${running.done}/${running.total}` : action.label}
          </button>
        );
      })}

      <button
        type="button"
        onClick={clearSelection}
        disabled={busy}
        className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-600 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] disabled:opacity-50"
        aria-label="Clear selection"
      >
        <MdClose size={17} /> Clear
      </button>

      <span className="sr-only" aria-live="polite">
        {running ? `${running.label}: ${running.done} of ${running.total} done` : ''}
      </span>
    </div>
  );
}
