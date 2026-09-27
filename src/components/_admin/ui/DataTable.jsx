'use client';

import { useEffect } from 'react';
import SortTh from 'src/components/_admin/shared/SortTh';
import { BulkActionBar, SelectionCheckbox, useBulkSelection } from './bulkSelection';
import { TableSkeleton, EmptyState, ErrorState } from './TableStates';
import Pagination from './Pagination';
import GlobalTable from './GlobalTable';

const alignClass = (align) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left');

// Low-priority columns drop out on narrow screens instead of forcing a wide
// sideways scroll; the first column always stays.
const HIDE_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell'
};

/**
 * Compact list table with sorting, pagination and page-aware bulk selection.
 *
 * columns: [{ key, label, sortable?, align?, hideBelow?: 'sm'|'md'|'lg'|'xl',
 *             srLabel?, headerClassName?, className?, render: (row) => node }]
 *
 * onRowClick opens a record from anywhere on the row (Enter/Space too);
 * isFetching shows a thin bar during a background refresh; `error` (with
 * `onRetry`) shows the load failure in place of the rows.
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
  rowLabel,
  isLoading = false,
  isFetching = false,
  error = null,
  onRetry,
  empty,
  footer,
  pagination,
  caption,
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

  const progress = isFetching && !isLoading && (
    <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-slate-100" role="status" aria-label="Updating">
      <div className="h-full w-1/3 animate-pulse bg-slate-400" />
    </div>
  );

  if (children) {
    return (
      <div className="card-ui relative overflow-hidden">
        {progress}
        <GlobalTable className={className}>{children}</GlobalTable>
        {footer || (pagination && <Pagination {...pagination} />)}
      </div>
    );
  }

  const hideClass = (col) => (col.hideBelow ? HIDE_BELOW[col.hideBelow] : '');

  return (
    <div className="card-ui relative overflow-hidden">
      {progress}
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
      {error && !data.length ? (
        <ErrorState error={error} title="This list could not be loaded" onRetry={onRetry} className="!rounded-none !border-0 !shadow-none" />
      ) : isLoading ? (
        <TableSkeleton rows={8} cols={columns.length + (selectable ? 1 : 0)} />
      ) : data.length === 0 ? (
        empty || <EmptyState />
      ) : (
        <GlobalTable className={`${isFetching ? 'opacity-70 transition-opacity' : ''} ${className}`}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="w-11 text-center">
                  <SelectionCheckbox
                    checked={allPageSelected}
                    indeterminate={selectedOnPage > 0 && !allPageSelected}
                    onChange={togglePage}
                    label={allPageSelected ? 'Deselect all rows on this page' : 'Select all rows on this page'}
                  />
                </th>
              )}
              {columns.map((col) =>
                col.sortable && sort ? (
                  <SortTh
                    key={col.key}
                    field={col.key}
                    label={col.label}
                    align={col.align}
                    sortBy={sort.by}
                    sortOrder={sort.order}
                    onSort={sort.onSort}
                    className={`${hideClass(col)} ${col.headerClassName || ''}`}
                  />
                ) : (
                  <th key={col.key} scope="col" className={`${alignClass(col.align)} ${hideClass(col)} ${col.headerClassName || ''}`}>
                    {col.label ? col.label : col.srLabel ? <span className="sr-only">{col.srLabel}</span> : null}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const key = String(rowKey(row, i));
              const rowSelected = isSelected(key);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  aria-selected={selectable ? rowSelected : undefined}
                  className={`${rowSelected ? '!bg-slate-50' : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {selectable && (
                    <td className="w-11 text-center" onClick={(event) => event.stopPropagation()}>
                      <SelectionCheckbox
                        checked={rowSelected}
                        onChange={() => toggleRow(key, row)}
                        label={`${rowSelected ? 'Deselect' : 'Select'} row ${i + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`${alignClass(col.align)} ${hideClass(col)} ${col.className || ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </GlobalTable>
      )}
      {footer || (pagination && <Pagination {...pagination} />)}
    </div>
  );
}

/** Keeps a click on a button or link inside a clickable row from also opening the row. */
export const stopRow = (event) => event.stopPropagation();
