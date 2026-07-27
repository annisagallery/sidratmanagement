'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MdClose, MdContentCopy, MdDownload } from 'react-icons/md';
import SortTh from 'src/components/_admin/shared/SortTh';
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
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-violet-600 focus:ring-2 focus:ring-violet-500 focus:ring-offset-1"
    />
  );
}

/**
 * Compact list table with sorting, pagination and page-aware bulk selection.
 * bulkActions: [{ label, icon?, onClick(selectedRows), tone?, disabled?, loading? }]
 */
export default function DataTable({
  columns = [],
  data = [],
  sort,
  rowKey = (row, i) => row.id ?? row.id ?? i,
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
  const [notice, setNotice] = useState('');
  const pageRows = useMemo(() => data.map((row, i) => [String(rowKey(row, i)), row]), [data, rowKey]);
  const selectedRows = useMemo(() => Array.from(selected.values()), [selected]);
  const selectedOnPage = pageRows.filter(([key]) => selected.has(key)).length;
  const allPageSelected = pageRows.length > 0 && selectedOnPage === pageRows.length;

  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [onSelectionChange, selectedRows]);

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

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2500);
  };

  const copyIdentifiers = async () => {
    const ids = selectedRows.map((row, i) => row?.id ?? row?.id ?? row?.orderNo ?? i + 1).join('\n');
    await navigator.clipboard.writeText(ids);
    showNotice(`${selectedRows.length} identifier${selectedRows.length === 1 ? '' : 's'} copied`);
  };

  const exportSelected = () => {
    const exportColumns = columns.filter((column) => column.exportable !== false && column.key !== 'actions');
    const csv = [
      exportColumns.map((column) => csvCell(column.label || column.key)).join(','),
      ...selectedRows.map((row) => exportColumns.map((column) => csvCell(safeCellValue(column, row))).join(','))
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName;
    link.click();
    URL.revokeObjectURL(url);
    showNotice(`${selectedRows.length} ${selectionLabel} exported`);
  };

  if (children) {
    return (
      <div className="card-ui overflow-hidden">
        <GlobalTable className={className}>{children}</GlobalTable>
        {footer || (pagination && <Pagination {...pagination} />)}
      </div>
    );
  }

  return (
    <div className="card-ui overflow-hidden">
      {selectable && selectedRows.length > 0 && (
        <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-violet-200 bg-violet-50 px-3 py-2" role="region" aria-label="Bulk actions">
          <span className="mr-1 text-sm font-semibold text-violet-950">{selectedRows.length} {selectionLabel} selected</span>
          <button type="button" onClick={exportSelected} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-800 transition hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500">
            <MdDownload size={17} /> Export CSV
          </button>
          <button type="button" onClick={copyIdentifiers} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-800 transition hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500">
            <MdContentCopy size={16} /> Copy IDs
          </button>
          {bulkActions.map((action) => {
            const Icon = action.icon;
            const danger = action.tone === 'danger';
            return (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled || action.loading}
                onClick={async () => {
                  const completed = await action.onClick(selectedRows);
                  if (completed !== false && action.clearOnSuccess !== false) setSelected(new Map());
                }}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${danger ? 'border-red-200 text-red-700 hover:bg-red-50 focus:ring-red-500' : 'border-violet-200 text-violet-800 hover:bg-violet-100 focus:ring-violet-500'}`}
              >
                {Icon && <Icon size={16} />} {action.loading ? 'Working…' : action.label}
              </button>
            );
          })}
          <button type="button" onClick={() => setSelected(new Map())} className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" aria-label="Clear selection">
            <MdClose size={17} /> Clear
          </button>
          <span className="sr-only" aria-live="polite">{notice}</span>
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
                    <SelectionCheckbox checked={allPageSelected} indeterminate={selectedOnPage > 0 && !allPageSelected} onChange={togglePage} label={allPageSelected ? 'Deselect all rows on this page' : 'Select all rows on this page'} />
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
                  <tr key={key} onClick={onRowClick ? () => onRowClick(row) : undefined} aria-selected={isSelected} className={`transition ${isSelected ? 'bg-violet-50/70 hover:bg-violet-50' : 'hover:bg-slate-50'} ${onRowClick ? 'cursor-pointer' : ''}`}>
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
