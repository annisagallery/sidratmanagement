'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { toast } from 'react-toastify';
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
import * as api from 'src/services';
import { fDate, fDateTime } from 'src/utils/formatTime';

const PAGE_SIZE = 25;

// Column `link` type → detail page. The server puts the raw identifier in row._refs[col.key].
const LINKS = {
  order: (ref) => `/orders/${ref}`,
  posOrder: (ref) => `/pos-sales/${ref}`,
  product: (ref) => `/products/${ref}/view`,
  customer: (ref) => `/users/${ref}`,
  coupon: (ref) => `/coupon-codes/${ref}`,
  campaign: (ref) => `/campaigns/${ref}`
};

// ── Formatting ─────────────────────────────────────────────────────────────────
const STATUS_CLS = {
  active: 'bg-emerald-100 text-emerald-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  received: 'bg-emerald-100 text-emerald-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  earned: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-blue-100 text-blue-700',
  'in transit': 'bg-sky-100 text-sky-700',
  shipped: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
  blocked: 'bg-red-100 text-red-700',
  spent: 'bg-red-100 text-red-700',
  returned: 'bg-orange-100 text-orange-700',
  refunded: 'bg-orange-100 text-orange-700',
  refund: 'bg-orange-100 text-orange-700',
  exchange: 'bg-violet-100 text-violet-700',
  unpaid: 'bg-gray-100 text-gray-500',
  inactive: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
  draft: 'bg-gray-100 text-gray-500'
};

function StatusBadge({ value }) {
  const norm = String(value || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ');
  const cls = STATUS_CLS[norm] || STATUS_CLS[norm.split(' ')[0]] || 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}
    >
      {norm || '—'}
    </span>
  );
}

function Cell({ col, value }) {
  if (value == null || value === '' || value === '—') return <span className="text-slate-300">—</span>;
  if (col.type === 'date') return <span className="whitespace-nowrap text-xs text-slate-500">{fDate(value)}</span>;
  if (col.type === 'datetime')
    return <span className="whitespace-nowrap text-xs text-slate-500">{fDateTime(value)}</span>;
  if (col.type === 'currency')
    return (
      <span className="whitespace-nowrap font-medium tabular-nums text-slate-800">
        ৳{Number(value).toLocaleString()}
      </span>
    );
  if (col.type === 'number')
    return <span className="tabular-nums text-slate-700">{Number(value).toLocaleString()}</span>;
  if (col.type === 'status') return <StatusBadge value={value} />;
  if (col.type === 'boolean')
    return value === true || value === 'true' ? (
      <span className="text-xs font-medium text-emerald-600">Yes</span>
    ) : (
      <span className="text-xs text-slate-400">No</span>
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
      className="font-medium underline-offset-2 hover:underline"
      style={{ color: 'var(--brand-strong)' }}
    >
      {String(value)}
    </Link>
  );
}

// ── Filter form pieces ─────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors"
      style={{ backgroundColor: on ? 'var(--brand)' : '#cbd5e1' }}
    >
      <span
        className={`inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-[16px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

function FilterField({ filter, options, value, onChange, disabled }) {
  const cls = disabled ? 'pointer-events-none opacity-40' : '';
  const selectOptions = filter.options || options[filter.optionsKey] || [];

  if (filter.type === 'select') {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`select-ui w-full ${cls}`}>
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
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`select-ui w-full ${cls}`}>
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
          value={v.min}
          onChange={(e) => onChange({ ...v, min: e.target.value })}
          className="input-ui w-full"
        />
        <span className="text-slate-300">–</span>
        <input
          type="number"
          placeholder="Max"
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
          value={v.start}
          onChange={(e) => onChange({ ...v, start: e.target.value })}
          className="input-ui w-full"
        />
        <span className="text-slate-300">–</span>
        <input
          type="date"
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
  if (!active) return <FiChevronDown size={11} className="ml-1 opacity-30" />;
  return dir === 'asc' ? <FiChevronUp size={11} className="ml-1" /> : <FiChevronDown size={11} className="ml-1" />;
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ReportWorkspace({ reportKey }) {
  const { data: catalog, isLoading: catalogLoading } = useQuery('report-catalog', api.getReportCatalog);
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

  const { data, isLoading, isFetching } = useQuery(
    ['report', reportKey, params],
    () => api.getReport(reportKey, params),
    { enabled: !!meta, keepPreviousData: true }
  );

  if (catalogLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-72 animate-pulse rounded-md bg-slate-100" />
        <div className="h-48 animate-pulse rounded-md border border-slate-200 bg-slate-100" />
        <div className="h-80 animate-pulse rounded-md border border-slate-200 bg-slate-100" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="card-ui px-6 py-16 text-center">
        <p className="font-medium text-slate-700">Unknown report</p>
        <p className="mt-1 text-sm text-slate-500">This report does not exist.</p>
        <Link href="/reports" className="btn-brand mt-4 inline-flex items-center gap-1.5">
          <FiChevronLeft size={14} /> All reports
        </Link>
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
      toast.error(err?.response?.data?.message || 'PDF export failed');
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
      toast.error(err?.response?.data?.message || 'Excel export failed');
    } finally {
      setXlsBusy(false);
    }
  }

  const appliedCount = Object.keys(applied).length;

  return (
    <div className="space-y-4">
      <PageHeader title={`${meta.label} Report`} subtitle={meta.description} icon={FiBarChart2}>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <FiChevronLeft size={14} /> All Reports
        </Link>
        <button
          type="button"
          onClick={exportExcel}
          disabled={xlsBusy || total === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {xlsBusy ? <Spinner /> : <FiGrid size={14} />} Excel
        </button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={pdfBusy || total === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pdfBusy ? <Spinner /> : <FiFileText size={14} />} PDF
        </button>
      </PageHeader>

      {/* Filter form — toggle a filter on, set its value, then submit. Header collapses the whole form. */}
      <form onSubmit={submit} className="card-ui overflow-hidden">
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-slate-50/60 ${
            formOpen ? 'border-b border-slate-100' : ''
          }`}
        >
          <span className="text-sm font-semibold text-slate-700">Customize the report</span>
          <span className="flex items-center gap-2 text-xs text-slate-400">
            {appliedCount > 0
              ? `${appliedCount} filter${appliedCount > 1 ? 's' : ''} applied`
              : 'Switch a filter on, set its value, then generate'}
            {formOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          </span>
        </button>
        {formOpen && (
          <>
            <div className="grid gap-x-6 gap-y-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {meta.filters.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 flex items-center gap-2">
                    <Toggle on={!!enabled[f.key]} onChange={() => toggleFilter(f.key)} />
                    <span className={`text-xs font-semibold ${enabled[f.key] ? 'text-slate-700' : 'text-slate-400'}`}>
                      {f.label}
                    </span>
                  </label>
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
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
              <button type="submit" className="btn-brand inline-flex items-center gap-1.5">
                <FiSearch size={14} /> Generate Report
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <FiRotateCcw size={13} /> Reset
              </button>
              {appliedCount > 0 && (
                <span className="ml-auto text-xs text-slate-500">
                  {appliedCount} filter{appliedCount > 1 ? 's' : ''} applied
                </span>
              )}
            </div>
          </>
        )}
      </form>

      {/* Summary tiles */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {summary.map((s) => (
            <div key={s.key} className="card-ui px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
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
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {meta.columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  className={`select-none whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.sortField ? 'cursor-pointer transition-colors hover:bg-slate-100 hover:text-slate-800' : ''}`}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.sortField && <SortIcon active={sortField === col.sortField} dir={sortDir} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {busy ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {meta.columns.map((c, j) => (
                    <td key={c.key} className="px-4 py-3">
                      <div
                        className="h-3.5 animate-pulse rounded-md bg-slate-100"
                        style={{ width: `${40 + ((i + j) % 4) * 15}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={meta.columns.length} className="px-6 py-16 text-center text-slate-400">
                  <MdInbox size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium text-slate-500">No data found</p>
                  <p className="mt-1 text-xs">Adjust the filters above and generate again</p>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-slate-50/50">
                  {meta.columns.map((col) => (
                    <td key={col.key} className={`px-4 py-2.5 ${col.align === 'right' ? 'text-right' : ''}`}>
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
