'use client';

import { useEffect } from 'react';
import SortTh from 'src/components/_admin/shared/SortTh';
import { BulkActionBar, SelectionCheckbox, useBulkSelection } from './bulkSelection';
import { TableSkeleton, EmptyState } from './TableStates';
import Pagination from './Pagination';
import GlobalTable from './GlobalTable';

const alignClass = (align) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left');

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
  const {
    selectedRows,
    selectedOnPage,
    allPageSelected,
    offPageCount,
    isSelected,
    toggleRow,
    togglePage,
    clearSelection
  } = useBulkSelection({ data, rowKey });

  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [onSelectionChange, selectedRows]);

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
      {selectable && (
        <BulkActionBar
          selectedRows={selectedRows}
          offPageCount={offPageCount}
          clearSelection={clearSelection}
          bulkActions={bulkActions}
          columns={columns}
          selectionLabel={selectionLabel}
          exportFileName={exportFileName}
        />
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
                const rowSelected = isSelected(key);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    aria-selected={rowSelected}
                    className={`transition ${rowSelected ? 'bg-[var(--brand-soft)]' : 'hover:bg-slate-50'} ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {selectable && (
                      <td className="w-11 px-3 py-2 text-center" onClick={(event) => event.stopPropagation()}>
                        <SelectionCheckbox checked={rowSelected} onChange={() => toggleRow(key, row)} label={`${rowSelected ? 'Deselect' : 'Select'} row ${i + 1}`} />
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
