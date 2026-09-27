'use client';
import React from 'react';
import { useQuery } from 'react-query';
import { MdSearch, MdOutlineSecurity } from 'react-icons/md';
import * as api from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Badge from 'src/components/_admin/ui/Badge';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';

// Coerce numbers that might arrive as strings
const toNum = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? Number(n) : 0;
};

/** How a delivery record reads, and the tone that goes with it. */
function verdict(ratio, total) {
  if (!total) return { label: 'No history', tone: 'neutral' };
  if (ratio >= 95) return { label: 'Excellent', tone: 'success' };
  if (ratio >= 85) return { label: 'Great', tone: 'success' };
  if (ratio >= 70) return { label: 'Good', tone: 'warning' };
  return { label: 'Poor', tone: 'danger' };
}

const TONE_COLOR = { success: '#059669', warning: '#d97706', danger: '#e11d48', neutral: '#94a3b8' };

function SuccessRing({ percent = 0, color }) {
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative mx-auto h-36 w-36" aria-hidden>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (p / 100) * circumference}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tabular-nums text-slate-900">
        {p.toFixed(1)}%
      </span>
    </div>
  );
}

export default function Page() {
  const [phone, setPhone] = React.useState('');
  const [phoneError, setPhoneError] = React.useState('');
  const [submittedPhone, setSubmittedPhone] = React.useState(null);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery(
    ['fraudCheck', submittedPhone],
    () => api.fraudCheck(submittedPhone),
    {
      enabled: !!submittedPhone, // only run after submit
      keepPreviousData: true
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = phone.trim();
    // Basic BD mobile format check
    if (!/^01\d{9}$/.test(trimmed)) {
      setPhoneError('Enter an 11-digit Bangladeshi mobile number, like 01XXXXXXXXX.');
      return;
    }
    setPhoneError('');
    setSubmittedPhone(trimmed);
    if (submittedPhone) refetch();
  };

  const rows = React.useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data)
      .filter(([provider]) => provider !== 'errors')
      .map(([provider, stats]) => {
        const total = toNum(stats?.total);
        const success = toNum(stats?.success);
        const returned = toNum(stats?.returned);
        const rate = total > 0 ? (success / total) * 100 : null;
        const labels = { pathao: 'Pathao', steadFast: 'Steadfast', carryBee: 'CarryBee' };
        return { provider, label: labels[provider] || provider, total, success, returned, rate };
      });
  }, [data]);

  const totals = React.useMemo(() => {
    const total = rows.reduce((a, r) => a + toNum(r.total), 0);
    const success = rows.reduce((a, r) => a + toNum(r.success), 0);
    const returned = rows.reduce((a, r) => a + toNum(r.returned), 0);
    const ratio = total > 0 ? (success / total) * 100 : 0;
    return { total, success, returned, ratio };
  }, [rows]);

  const overall = verdict(totals.ratio, totals.total);
  const busy = isLoading || isFetching;

  return (
    <div className="space-y-6">
      <PageHeader title="Fraud check" subtitle="A customer's delivery record with each courier, by phone number." />

      <form onSubmit={handleSubmit} className="card-ui p-5" noValidate role="search">
        <label htmlFor="fraud-phone" className="mb-1.5 block text-[13px] font-medium text-slate-800">
          Customer phone number
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1 sm:max-w-md">
            <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
            <input
              id="fraud-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError('');
              }}
              placeholder="01XXXXXXXXX"
              aria-invalid={Boolean(phoneError)}
              aria-describedby={phoneError ? 'fraud-phone-error' : undefined}
              className="input-ui pl-9"
            />
          </div>
          <button type="submit" className="btn-brand" disabled={busy}>
            {busy ? 'Checking…' : 'Check record'}
          </button>
        </div>
        {phoneError ? (
          <p id="fraud-phone-error" className="mt-1.5 text-[13px] font-medium text-rose-700" role="alert">
            {phoneError}
          </p>
        ) : null}
      </form>

      {busy ? (
        <div className="grid gap-6 lg:grid-cols-3" aria-busy="true">
          <div className="card-ui h-64 animate-pulse lg:col-span-2" />
          <div className="card-ui h-64 animate-pulse" />
        </div>
      ) : isError ? (
        <ErrorState error={error} title="The courier records could not be checked" onRetry={refetch} />
      ) : !submittedPhone ? (
        <div className="card-ui">
          <EmptyState
            icon={MdOutlineSecurity}
            title="Check a customer before you ship"
            hint="Enter a phone number to see how many of their parcels each courier delivered or returned."
          />
        </div>
      ) : !data || rows.length === 0 ? (
        <div className="card-ui">
          <EmptyState icon={MdOutlineSecurity} title={`No courier history for ${submittedPhone}`} hint="This number has not been used with any connected courier." />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <section className="card-ui overflow-hidden lg:col-span-2" aria-labelledby="fraud-by-courier">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4 pt-5">
              <h2 id="fraud-by-courier" className="text-[15px] font-semibold text-slate-900">
                By courier
              </h2>
              <span className="text-[13px] text-slate-500">
                Phone <span className="ops-code font-medium text-slate-900">{submittedPhone}</span>
              </span>
            </div>
            <GlobalTable>
              <caption className="sr-only">Deliveries by courier for {submittedPhone}</caption>
              <thead>
                <tr>
                  <th scope="col">Courier</th>
                  <th scope="col" className="text-right">Parcels</th>
                  <th scope="col" className="text-right">Delivered</th>
                  <th scope="col" className="text-right">Returned</th>
                  <th scope="col" className="text-right">Success rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const v = verdict(r.rate ?? 0, r.total);
                  return (
                    <tr key={r.provider}>
                      <td className="font-medium text-slate-900">{r.label}</td>
                      <td className="text-right tabular-nums">{r.total}</td>
                      <td className="text-right tabular-nums">{r.success}</td>
                      <td className="text-right tabular-nums">{r.returned}</td>
                      <td className="text-right">
                        {r.rate == null ? <span className="text-slate-400">—</span> : <Badge tone={v.tone}>{r.rate.toFixed(1)}%</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-4 py-3 text-[13px] font-semibold text-slate-900">All couriers</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-900">{totals.total}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-900">{totals.success}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-900">{totals.returned}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-900">
                    {totals.total > 0 ? `${totals.ratio.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tfoot>
            </GlobalTable>
          </section>

          <section className="card-ui p-5 text-center" aria-labelledby="fraud-overall">
            <h2 id="fraud-overall" className="text-left text-[15px] font-semibold text-slate-900">
              Overall delivery success
            </h2>
            <div className="mt-5">
              <SuccessRing percent={totals.ratio} color={TONE_COLOR[overall.tone]} />
            </div>
            <p className="mt-4">
              <Badge tone={overall.tone}>{overall.label}</Badge>
            </p>
            <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-left">
              {[
                ['Parcels', totals.total],
                ['Delivered', totals.success],
                ['Returned', totals.returned]
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-3 py-2.5">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
