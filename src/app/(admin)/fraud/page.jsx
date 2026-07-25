'use client';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';

import React from 'react';
import * as api from 'src/services'; // keep your path
import { useQuery } from 'react-query';
import Swal from 'sweetalert2';

// Coerce numbers that might arrive as strings
const toNum = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? Number(n) : 0;
};

function verdictLabel(ratio) {
  if (ratio >= 95) return 'Excellent';
  if (ratio >= 85) return 'Great';
  if (ratio >= 70) return 'Good';
  if (ratio > 0) return 'Poor';
  return '—';
}

function SuccessRing({ percent = 0 }) {
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <div className="mx-auto inline-grid place-items-center">
      <div className="h-36 w-36 rounded-md" style={{ background: `conic-gradient(#16a34a ${p}%, #e5e7eb 0)` }}>
        <div className="m-3 grid h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] place-items-center rounded-md bg-white">
          <span className="text-xl font-semibold text-gray-800">{p.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [phone, setPhone] = React.useState('');
  const [submittedPhone, setSubmittedPhone] = React.useState(null);

  const { data, isLoading, isFetching, refetch } = useQuery(
    ['fraudCheck', submittedPhone],
    () => api.fraudCheck(submittedPhone),
    {
      enabled: !!submittedPhone, // only run after submit
      keepPreviousData: true,
      onError: (err) => Swal.fire(err?.response?.data?.message || 'Something went wrong!', '', 'error')
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = phone.trim();

    // Basic BD mobile format check
    if (!/^01\d{9}$/.test(trimmed)) {
      Swal.fire('Please enter a valid Bangladeshi phone number (e.g., 01XXXXXXXXX).', '', 'warning');
      return;
    }

    setSubmittedPhone(trimmed);
    if (submittedPhone) refetch();
  };

  // Table rows
  const rows = React.useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data).filter(([provider]) => provider !== 'errors').map(([provider, stats]) => {
      const total = toNum(stats?.total);
      const success = toNum(stats?.success);
      const returned = toNum(stats?.returned);
      const successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '—';
      const labels = { pathao: 'Pathao', steadFast: 'Steadfast', carryBee: 'CarryBee' };
      return { provider, label: labels[provider] || provider, total, success, returned, successRate };
    });
  }, [data]);

  // Aggregates for the right card
  const totals = React.useMemo(() => {
    const total = rows.reduce((a, r) => a + toNum(r.total), 0);
    const success = rows.reduce((a, r) => a + toNum(r.success), 0);
    const returned = rows.reduce((a, r) => a + toNum(r.returned), 0);
    const ratio = total > 0 ? (success / total) * 100 : 0;
    return { total, success, returned, ratio };
  }, [rows]);

  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-800 p-4 bg-white border text-center">
        Fraud Check
      </h1>

      {/* Search Form */}
      <form
        onSubmit={handleSubmit}
        className="my-3 flex flex-col gap-3 border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter phone number (e.g., 019XXXXXXXX)"
            className="block w-full rounded-md border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:ring-offset-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.9 14.32a8 8 0 111.414-1.414l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"
              clipRule="evenodd"
            />
          </svg>
          Search
        </button>
      </form>

      {/* States */}
      {isLoading || isFetching ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto h-6 w-6 animate-spin rounded-md border-2 border-gray-300 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-600">Checking…</p>
        </div>
      ) : !submittedPhone ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          Enter a phone number above and press <span className="font-medium">Search</span>.
        </div>
      ) : !data || rows.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-600 shadow-sm">
          No data found for <span className="font-semibold">{submittedPhone}</span>.
        </div>
      ) : (
        // Redesigned content with right-side stats card
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: Table */}
          <div className="overflow-hidden border border-gray-200 bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold text-gray-800">Fraud Check Result</h2>
              <span className="text-xs text-gray-500">
                Phone: <span className="font-medium">{submittedPhone}</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <GlobalTable className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Courier
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600 text-center">
                      Total
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600 text-center">
                      Success
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600 text-center">
                      Returned
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600 text-center">
                      Success Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((r) => (
                    <tr key={r.provider} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.label}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center">{r.total}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center">{r.success}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center">{r.returned}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
                          {r.successRate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Table footer: totals */}
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">Total</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-center">{totals.total}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-center">{totals.success}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-center">{totals.returned}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-center">
                      {totals.total > 0 ? `${totals.ratio.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </GlobalTable>
            </div>
          </div>

          {/* Right: Summary Card */}
          <div className="border border-gray-200 bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h3 className="text-base font-semibold text-gray-800">Delivery Success Ratio</h3>
            </div>

            <div className="px-6 py-6 text-center">
              <SuccessRing percent={totals.ratio} />
              <p className="mt-4 text-xl font-semibold text-gray-900">{verdictLabel(totals.ratio)}</p>

              <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="font-semibold text-gray-800">{totals.total}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Success</p>
                  <p className="font-semibold text-gray-800">{totals.success}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Returned</p>
                  <p className="font-semibold text-gray-800">{totals.returned}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
