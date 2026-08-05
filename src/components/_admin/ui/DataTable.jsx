'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MdClose, MdContentCopy, MdDownload } from 'react-icons/md';
import SortTh from 'src/components/_admin/shared/SortTh';
import { alertBulkResult, toastSuccess } from 'src/utils/swal';
import { describeRow, runBulk } from 'src/utils/bulk';
import { TableSkeleton, EmptyState } from './TableStates';
import Pagination from './Pagination';
import GlobalTable from './GlobalTable';

const alignClass = (align) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left');
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const safeCellValue = (column, row) => {
  const value = column.exportValue ? column.exportValue(row) : row?.[column.key];
  if (value == null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

function SelectionCheckbox({ checked, indeterminate = false, label, onChange }) {
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

/**
 * Compact list table with sorting, pagination and page-aware bulk selection.
 *
 * Bulk actions are declared, not implemented, by the list that uses them:
 *
 *   { label, icon, tone, action: 'Deleted', unit: 'products',
 *     confirm: (rows) => confirmDelete({ ... }),   // optional gate
 *     perform: (row) => api.deleteProduct(row.slug),
 *     onSettled: () => qc.invalidateQueries(...) }
 *
 * This component owns the parts every list got subtly different on its own:
 * running the rows one at a time, showing progress, reporting partial success,
 * and clearing the selection only when something actually changed. Use
 * `onClick(rows)` instead of `perform` for an action that takes the whole
 * selection in a single request.
 */
export default function DataTable({
  columns = [],
  data = [],
  sort,
  rowKey = (row, i) => row.id ?? i,
  onRowClick,
  isLoading = false,
  empty,
  footer,
  pagination,
  selectable = true,
  bulkActions = [],
  selectionLabel = 'rows',
  exportFileName = 'selected-rows.csv',
  onSelectionChange,
  children,
  className = ''
}) {
  const [selected, setSelected] = useState(() => new Map());
  const [running, setRunning] = useState(null);
  const pageRows = useMemo(() => data.map((row, i) => [String(rowKey(row, i)), row]), [data, rowKey]);
  const selectedRows = useMemo(() => Array.from(selected.values()), [selected]);
  const selectedOnPage = pageRows.filter(([key]) => selected.has(key)).length;
  const allPageSelected = pageRows.length > 0 && selectedOnPage === pageRows.length;
  const offPageCount = selectedRows.length - selectedOnPage;

  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [onSelectionChange, selectedRows]);

  const clearSelection = () => setSelected(new Map());

  const togglePage = () => {
    setSelected((current) => {
      const next = new Map(current);
      if (allPageSelected) pageRows.forEach(([key]) => next.delete(key));
      else pageRows.forEach(([key, row]) => next.set(key, row));
      return next;
    });
  };

  const toggleRow = (key, row) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else next.set(key, row);
      return next;
    });
  };

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
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
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

  if (children) {
    return (
      <div className="card-ui overflow-hidden">
        <GlobalTable className={className}>{children}</GlobalTable>
        {footer || (pagination && <Pagination {...pagination} />)}
      </div>
    );
  }

  const busy = Boolean(running);

  return (
    <div className="card-ui overflow-hidden">
      {selectable && selectedRows.length > 0 && (
        <div
          className="flex min-h-12 flex-wrap items-center gap-2 border-b border-[var(--brand)]/40 bg-[var(--brand-soft)] px-3 py-2"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="mr-1 text-sm font-semibold text-slate-900">
            {selectedRows.length} {selectionLabel} selected
            {offPageCount > 0 && (
              <span className="ml-1 font-normal text-slate-500">({offPageCount} on other pages)</span>
            )}
          </span>

          <button type="button" onClick={exportSelected} disabled={busy} className={barButton('neutral')}>
            <MdDownload size={17} /> Export CSV
          </button>
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
      )}
      {isLoading ? (
        <TableSkeleton rows={8} cols={columns.length + (selectable ? 1 : 0)} />
      ) : data.length === 0 ? (
        empty || <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <GlobalTable>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {selectable && (
                  <th className="w-11 px-3 py-2 text-center">
                    <SelectionCheckbox
                      checked={allPageSelected}
                      indeterminate={selectedOnPage > 0 && !allPageSelected}
                      onChange={togglePage}
                      label={allPageSelected ? 'Deselect all rows on this page' : 'Select all rows on this page'}
                    />
                  </th>
                )}
                {columns.map((col) => col.sortable && sort ? (
                  <SortTh key={col.key} field={col.key} label={col.label} align={col.align} sortBy={sort.by} sortOrder={sort.order} onSort={sort.onSort} />
                ) : (
                  <th key={col.key} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${alignClass(col.align)} ${col.headerClassName || ''}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row, i) => {
                const key = String(rowKey(row, i));
                const isSelected = selected.has(key);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    aria-selected={isSelected}
                    className={`transition ${isSelected ? 'bg-[var(--brand-soft)]' : 'hover:bg-slate-50'} ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {selectable && (
                      <td className="w-11 px-3 py-2 text-center" onClick={(event) => event.stopPropagation()}>
                        <SelectionCheckbox checked={isSelected} onChange={() => toggleRow(key, row)} label={`${isSelected ? 'Deselect' : 'Select'} row ${i + 1}`} />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={`px-3 py-2 text-[13px] text-slate-700 ${alignClass(col.align)} ${col.className || ''}`}>{col.render(row)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </GlobalTable>
        </div>
      )}
      {footer || (pagination && <Pagination {...pagination} />)}
    </div>
  );
}
