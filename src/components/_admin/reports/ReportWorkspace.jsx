'use client';
import { alertError } from 'src/utils/swal';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import {
  FiBarChart2,
  FiChevronDown,
  FiChevronLeft,
  FiChevronUp,
  FiFileText,
  FiGrid,
  FiRotateCcw,
  FiSearch
} from 'react-icons/fi';
import { MdInbox } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import Badge from 'src/components/_admin/ui/Badge';
import { Switch } from 'src/components/_admin/ui/fields';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';
import * as api from 'src/services';
import { fDate, fDateTime } from 'src/utils/formatTime';

const PAGE_SIZE = 25;

// Column `link` type → detail page. The server puts the raw identifier in row._refs[col.key].
const LINKS = {
  order: (ref) => `/orders/${ref}`,
  product: (ref) => `/products/${ref}/view`,
  customer: (ref) => `/users/${ref}`,
  coupon: (ref) => `/coupon-codes/${ref}`,
  campaign: (ref) => `/campaigns/${ref}`
};

// ── Formatting ─────────────────────────────────────────────────────────────────
const STATUS_TONE = {
  active: 'success',
  delivered: 'success',
  received: 'success',
  resolved: 'success',
  completed: 'success',
  paid: 'success',
  earned: 'success',
  approved: 'info',
  processing: 'info',
  reviewing: 'info',
  'in transit': 'info',
  shipped: 'info',
  pending: 'warning',
  partial: 'warning',
  high: 'danger',
  cancelled: 'danger',
  rejected: 'danger',
  blocked: 'danger',
  spent: 'danger',
  returned: 'warning',
  refunded: 'warning',
  refund: 'warning',
  exchange: 'violet',
  unpaid: 'neutral',
  inactive: 'neutral',
  expired: 'neutral',
  draft: 'neutral'
};

function StatusBadge({ value }) {
  const norm = String(value || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ');
  const tone = STATUS_TONE[norm] || STATUS_TONE[norm.split(' ')[0]] || 'neutral';
  return <Badge tone={tone}>{norm ? norm.replace(/^./, (c) => c.toUpperCase()) : '—'}</Badge>;
}

function Cell({ col, value }) {
  if (value == null || value === '' || value === '—') return <span className="text-slate-400">—</span>;
  if (col.type === 'date') return <span className="whitespace-nowrap text-slate-600">{fDate(value)}</span>;
  if (col.type === 'datetime') return <span className="whitespace-nowrap text-slate-600">{fDateTime(value)}</span>;
  if (col.type === 'currency')
    return (
      <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">
        ৳{Number(value).toLocaleString()}
      </span>
    );
  if (col.type === 'number')
    return <span className="tabular-nums text-slate-700">{Number(value).toLocaleString()}</span>;
  if (col.type === 'status') return <StatusBadge value={value} />;
  if (col.type === 'boolean')
    return value === true || value === 'true' ? (
      <span className="font-medium text-slate-900">Yes</span>
    ) : (
      <span className="text-slate-500">No</span>
    );
  return <span className="text-slate-700">{String(value)}</span>;
}

function LinkedCell({ col, value, refs }) {
  const ref = col.link && refs?.[col.key];
  if (!ref || value == null || value === '' || value === '—' || !LINKS[col.link]) {
    return <Cell col={col} value={value} />;
  }
  return (
    <Link
      href={LINKS[col.link](ref)}
      className="font-medium text-slate-900 underline-offset-2 hover:underline"
    >
      {String(value)}
    </Link>
  );
}

// ── Filter form pieces ─────────────────────────────────────────────────────────

function FilterField({ filter, options, value, onChange, disabled }) {
  const cls = disabled ? 'opacity-50' : '';
  const label = filter.label;
  const selectOptions = filter.options || options[filter.optionsKey] || [];

  if (filter.type === 'select') {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label} className={`select-ui w-full ${cls}`}>
        <option value="">All</option>
        {selectOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (filter.type === 'boolean') {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label} className={`select-ui w-full ${cls}`}>
        <option value="">All</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (filter.type === 'numberrange') {
    const v = value || { min: '', max: '' };
    return (
      <div className={`flex items-center gap-1.5 ${cls}`}>
        <input
          type="number"
          placeholder="Min"
          aria-label={`${label} from`}
          disabled={disabled}
          value={v.min}
          onChange={(e) => onChange({ ...v, min: e.target.value })}
          className="input-ui w-full"
        />
        <span className="text-slate-400">–</span>
        <input
          type="number"
          placeholder="Max"
          aria-label={`${label} to`}
          disabled={disabled}
          value={v.max}
          onChange={(e) => onChange({ ...v, max: e.target.value })}
          className="input-ui w-full"
        />
      </div>
    );
  }
  if (filter.type === 'daterange') {
    const v = value || { start: '', end: '' };
    return (
      <div className={`flex items-center gap-1.5 ${cls}`}>
        <input
          type="date"
          aria-label={`${label} from`}
          disabled={disabled}
          value={v.start}
          onChange={(e) => onChange({ ...v, start: e.target.value })}
          className="input-ui w-full"
        />
        <span className="text-slate-400">–</span>
        <input
          type="date"
          aria-label={`${label} to`}
          disabled={disabled}
          value={v.end}
          onChange={(e) => onChange({ ...v, end: e.target.value })}
          className="input-ui w-full"
        />
      </div>
    );
  }
  return (
    <input
      type="text"
      value={value || ''}
      aria-label={label}
      disabled={disabled}
      placeholder={filter.label}
      onChange={(e) => onChange(e.target.value)}
      className={`input-ui w-full ${cls}`}
    />
  );
}

/** Keep only enabled filters whose value is actually filled in. */
function buildApplied(filters, enabled, values) {
  const out = {};
  for (const f of filters) {
    if (!enabled[f.key]) continue;
    const v = values[f.key];
    if (v == null) continue;
    if (f.type === 'numberrange') {
      if (v.min !== '' || v.max !== '') out[f.key] = v;
    } else if (f.type === 'daterange') {
      if (v.start || v.end) out[f.key] = v;
    } else if (String(v).trim() !== '') {
      out[f.key] = String(v).trim();
    }
  }
  return out;
}

/** Human-readable "Filters: …" line for exports. */
function describeFilters(filters, applied, options) {
  const parts = [];
  for (const f of filters) {
    const v = applied[f.key];
    if (v == null) continue;
    if (f.type === 'numberrange') parts.push(`${f.label}: ${v.min || '0'} – ${v.max || '∞'}`);
    else if (f.type === 'daterange') parts.push(`${f.label}: ${v.start || '…'} to ${v.end || '…'}`);
    else if (f.type === 'boolean') parts.push(`${f.label}: ${v === 'true' ? 'Yes' : 'No'}`);
    else if (f.type === 'select') {
      const opts = f.options || options[f.optionsKey] || [];
      parts.push(`${f.label}: ${opts.find((o) => o.value === v)?.label || v}`);
    } else parts.push(`${f.label}: ${v}`);
  }
  return parts.join('  ·  ');
}

function excelCell(col, value) {
  if (value == null || value === '' || value === '—') return '';
  if (col.type === 'date') return fDate(value);
  if (col.type === 'datetime') return fDateTime(value);
  if (col.type === 'currency' || col.type === 'number') return Number(value);
  if (col.type === 'boolean') return value === true || value === 'true' ? 'Yes' : 'No';
  return String(value);
}

function SortIcon({ active, dir }) {
  if (!active) return <FiChevronDown size={13} className="ml-1 text-slate-300" aria-hidden />;
  return dir === 'asc' ? <FiChevronUp size={13} className="ml-1" aria-hidden /> : <FiChevronDown size={13} className="ml-1" aria-hidden />;
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ReportWorkspace({ reportKey }) {
  const { data: catalog, isLoading: catalogLoading, isError: catalogFailed, error: catalogError, refetch: retryCatalog } = useQuery(
    'report-catalog',
    api.getReportCatalog
  );
  const meta = catalog?.data?.find((r) => r.key === reportKey);
  const options = catalog?.options || {};

  const [enabled, setEnabled] = useState({});
  const [values, setValues] = useState({});
  const [applied, setApplied] = useState({});
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(true);

  const sortField = sortBy || meta?.defaultSort || 'createdAt';

  const params = useMemo(() => {
    const p = new URLSearchParams({ page, pageSize: PAGE_SIZE, sortBy: sortField, sortDir });
    if (Object.keys(applied).length) p.set('filters', JSON.stringify(applied));
    return p.toString();
  }, [page, sortField, sortDir, applied]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery(
    ['report', reportKey, params],
    () => api.getReport(reportKey, params),
    { enabled: !!meta, keepPreviousData: true }
  );

  if (catalogLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-8 w-72" />
        <div className="card-ui h-48 animate-pulse" />
        <div className="card-ui h-80 animate-pulse" />
      </div>
    );
  }

  if (catalogFailed) {
    return <ErrorState error={catalogError} title="Reports could not be loaded" onRetry={retryCatalog} />;
  }

  if (!meta) {
    return (
      <div className="card-ui">
        <EmptyState
          icon={FiBarChart2}
          title="There is no such report"
          hint="It may have been renamed. Pick one from the list of reports."
          action={
            <Link href="/reports" className="btn-ghost">
              <FiChevronLeft size={15} aria-hidden /> All reports
            </Link>
          }
        />
      </div>
    );
  }

  const rows = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const summary = data?.summary || [];
  const busy = isLoading || isFetching;

  function toggleFilter(key) {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function submit(e) {
    e?.preventDefault();
    setApplied(buildApplied(meta.filters, enabled, values));
    setPage(1);
  }

  function reset() {
    setEnabled({});
    setValues({});
    setApplied({});
    setPage(1);
    setSortBy('');
    setSortDir('desc');
  }

  function handleSort(col) {
    if (!col.sortField) return;
    if (sortField === col.sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col.sortField);
      setSortDir('desc');
    }
    setPage(1);
  }

  async function fetchExportRows() {
    const p = new URLSearchParams({ export: '1', sortBy: sortField, sortDir });
    if (Object.keys(applied).length) p.set('filters', JSON.stringify(applied));
    return api.getReport(reportKey, p.toString());
  }

  async function exportPdf() {
    // Open the tab synchronously so the popup is not blocked, then point it at the blob.
    const win = window.open('', '_blank');
    setPdfBusy(true);
    try {
      const res = await fetchExportRows();
      const [{ pdf }, { default: ReportPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./reportPdf')
      ]);
      const blob = await pdf(
        <ReportPdf
          title={`${meta.label} Report`}
          columns={meta.columns}
          rows={res.data || []}
          summary={res.summary || []}
          filterText={describeFilters(meta.filters, applied, options)}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (win) win.location = url;
      else window.open(url, '_blank');
    } catch (err) {
      win?.close();
      alertError(err, { title: 'The PDF was not exported' });
    } finally {
      setPdfBusy(false);
    }
  }

  async function exportExcel() {
    setXlsBusy(true);
    try {
      const res = await fetchExportRows();
      const XLSX = await import('xlsx');
      const exportRows = res.data || [];
      const aoa = [
        meta.columns.map((c) => c.label),
        ...exportRows.map((row) => meta.columns.map((c) => excelCell(c, row[c.key])))
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = meta.columns.map((c) => ({ wch: Math.max(c.label.length + 2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, meta.label.slice(0, 31));
      XLSX.writeFile(wb, `${reportKey}-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alertError(err, { title: 'The Excel file was not exported' });
    } finally {
      setXlsBusy(false);
    }
  }

  const appliedCount = Object.keys(applied).length;

  return (
    <div className="space-y-6">
      <PageHeader title={`${meta.label} report`} subtitle={meta.description} eyebrow="Reports">
        <Link href="/reports" className="btn-ghost">
          <FiChevronLeft size={15} aria-hidden /> All reports
        </Link>
        <button type="button" onClick={exportExcel} disabled={xlsBusy || total === 0} className="btn-ghost">
          {xlsBusy ? <Spinner /> : <FiGrid size={15} aria-hidden />} Export Excel
        </button>
        <button type="button" onClick={exportPdf} disabled={pdfBusy || total === 0} className="btn-ghost">
          {pdfBusy ? <Spinner /> : <FiFileText size={15} aria-hidden />} Export PDF
        </button>
      </PageHeader>

      {/* Filter form — toggle a filter on, set its value, then submit. Header collapses the whole form. */}
      <form onSubmit={submit} className="card-ui overflow-hidden">
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          aria-expanded={formOpen}
          className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${
            formOpen ? 'border-b border-slate-200' : ''
          }`}
        >
          <span className="text-[15px] font-semibold text-slate-900">Filters</span>
          <span className="flex items-center gap-2 text-[13px] text-slate-500">
            {appliedCount > 0
              ? `${appliedCount} filter${appliedCount > 1 ? 's' : ''} applied`
              : 'Switch a filter on, set its value, then generate'}
            {formOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          </span>
        </button>
        {formOpen && (
          <>
            <div className="grid gap-x-6 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-3">
              {meta.filters.map((f) => (
                <div key={f.key}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Switch checked={!!enabled[f.key]} onChange={() => toggleFilter(f.key)} label={`Filter by ${f.label}`} />
                    <span className={`text-[13px] font-medium ${enabled[f.key] ? 'text-slate-900' : 'text-slate-500'}`}>{f.label}</span>
                  </div>
                  <FilterField
                    filter={f}
                    options={options}
                    value={values[f.key]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                    disabled={!enabled[f.key]}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button type="submit" className="btn-brand">
                <FiSearch size={15} aria-hidden /> Run report
              </button>
              <button type="button" onClick={reset} className="btn-ghost">
                <FiRotateCcw size={14} aria-hidden /> Reset
              </button>
              {appliedCount > 0 && (
                <span className="ml-auto text-[13px] text-slate-500">
                  {appliedCount} filter{appliedCount > 1 ? 's' : ''} applied
                </span>
              )}
            </div>
          </>
        )}
      </form>

      {/* Summary tiles */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-3 xl:grid-cols-5">
          {summary.map((s) => (
            <div key={s.key} className="bg-white px-5 py-4">
              <p className="truncate text-xs font-medium text-slate-500">{s.label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {s.format === 'currency'
                  ? `৳${Number(s.value ?? 0).toLocaleString()}`
                  : Number(s.value ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      <div className="card-ui overflow-hidden">
        <GlobalTable>
          <caption className="sr-only">{meta.label} report</caption>
          <thead>
            <tr>
              {meta.columns.map((col) => {
                const active = col.sortField && sortField === col.sortField;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {col.sortField ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={`inline-flex items-center rounded hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}
                      >
                        {col.label}
                        <SortIcon active={active} dir={sortDir} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {busy ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} aria-hidden>
                  {meta.columns.map((c, j) => (
                    <td key={c.key}>
                      <div className="skeleton h-3.5" style={{ width: `${40 + ((i + j) % 4) * 15}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={meta.columns.length} className="p-5">
                  <ErrorState error={error} title="The report could not be run" onRetry={refetch} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={meta.columns.length}>
                  <EmptyState icon={MdInbox} title="Nothing matches" hint="Change the filters and run the report again." />
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i}>
                  {meta.columns.map((col) => (
                    <td key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                      <LinkedCell col={col} value={row[col.key]} refs={row._refs} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </GlobalTable>
        <Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} pageSize={PAGE_SIZE} unit="rows" />
      </div>
    </div>
  );
}
