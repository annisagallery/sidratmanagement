'use client';

/**
 * Cash on delivery — what couriers still owe us, and matching their payouts.
 *
 * A courier pays out in batches, net of its fee, against a statement listing
 * consignments. This screen is that statement's other half: tick the
 * consignments the payout covers, correct any amount that arrived short, and
 * record it. Each order's COD payment is verified and the payout goes to HQ
 * finance for review. Anything short stays here until the rest arrives.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'react-query';
import { format } from 'date-fns';
import { MdPayments } from 'react-icons/md';

import * as api from 'src/services';
import { alertError, toastSuccess } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { KpiGrid, StatTile } from 'src/components/_admin/ui/kpi';
import { EmptyRow, ErrorRow, Field, LoadingRows, Pill, fieldClass, money } from 'src/components/_admin/ui/primitives';

const PROVIDER_LABEL = { pathao: 'Pathao', steadfast: 'Steadfast', carrybee: 'CarryBee' };

export default function CodRemittance() {
  const [provider, setProvider] = useState('');
  const [selected, setSelected] = useState({}); // shipmentId -> received amount (string)
  const [reference, setReference] = useState('');
  const [via, setVia] = useState('other');
  const [label, setLabel] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery(
    ['cod-outstanding', provider],
    () => api.getCodOutstanding(provider ? { provider } : {}),
    { refetchOnWindowFocus: false }
  );
  const rows = data?.data || [];
  const totals = data?.meta || { collected: 0, fees: 0, outstanding: 0 };

  const chosen = rows.filter((row) => selected[row.id] !== undefined);
  const receiving = chosen.reduce((sum, row) => sum + (Number(selected[row.id]) || 0), 0);
  const expecting = chosen.reduce((sum, row) => sum + row.outstanding, 0);
  const allChosen = rows.length > 0 && chosen.length === rows.length;

  const byProvider = useMemo(
    () =>
      rows.reduce((acc, row) => {
        acc[row.provider] = (acc[row.provider] || 0) + row.outstanding;
        return acc;
      }, {}),
    [rows]
  );

  const { mutate, isLoading: saving } = useMutation(
    () =>
      api.createCodRemittance({
        lines: chosen.map((row) => ({ shipmentId: row.id, receivedAmount: Number(selected[row.id]) || 0 })),
        reference: reference.trim(),
        via,
        paymentLabel: via === 'other' ? label.trim() || PROVIDER_LABEL[chosen[0]?.provider] || 'Courier payout' : ''
      }),
    {
      onSuccess: (response) => {
        const short = (response?.data?.lines || []).filter((line) => line.status === 'short').length;
        toastSuccess('Payout recorded', short ? `${short} consignment${short === 1 ? ' is' : 's are'} still short and stay on this list.` : undefined);
        setSelected({});
        setReference('');
        refetch();
      },
      onError: (err) => alertError(err, { title: 'The payout was not recorded' })
    }
  );

  function toggle(row) {
    setSelected((current) => {
      const next = { ...current };
      if (next[row.id] !== undefined) delete next[row.id];
      else next[row.id] = String(row.outstanding);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChosen ? {} : Object.fromEntries(rows.map((row) => [row.id, String(row.outstanding)])));
  }

  const shortBy = expecting - receiving;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="COD payouts" subtitle="Cash couriers collected on delivery and have not paid us yet." />

      <KpiGrid>
        <StatTile label="Still owed" value={money(totals.outstanding)} hint="By couriers, after fees" loading={isLoading} />
        <StatTile label="Collected" value={money(totals.collected)} hint="Cash taken at the door" loading={isLoading} />
        <StatTile label="Courier fees" value={money(totals.fees)} hint="Deducted from payouts" loading={isLoading} />
        <StatTile label="Consignments" value={rows.length.toLocaleString()} hint="Awaiting payout or short" loading={isLoading} />
      </KpiGrid>

      <section className="card-ui overflow-hidden" aria-labelledby="cod-title">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 id="cod-title" className="text-[15px] font-semibold text-slate-900">
              Awaiting payout
            </h2>
            <p className="text-[13px] text-slate-500">Tick what a courier payout covers, and correct any amount that arrived short.</p>
          </div>
          <select value={provider} onChange={(event) => setProvider(event.target.value)} className="select-ui" aria-label="Courier">
            <option value="">All couriers</option>
            {Object.entries(PROVIDER_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
                {byProvider[value] ? ` — ${money(byProvider[value])}` : ''}
              </option>
            ))}
          </select>
        </header>

        <GlobalTable>
          <caption className="sr-only">Consignments awaiting a courier payout</caption>
          <thead>
            <tr>
              <th scope="col" className="w-10">
                <input type="checkbox" checked={allChosen} onChange={toggleAll} disabled={!rows.length} aria-label="Select every consignment" />
              </th>
              <th scope="col">Order</th>
              <th scope="col">Courier</th>
              <th scope="col" className="text-right">Collected</th>
              <th scope="col" className="hidden text-right md:table-cell">Fee</th>
              <th scope="col" className="text-right">Owed</th>
              <th scope="col" className="text-right">Received now</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows colSpan={7} />
            ) : isError ? (
              <ErrorRow colSpan={7} error={error} onRetry={refetch} />
            ) : rows.length ? (
              rows.map((row) => {
                const on = selected[row.id] !== undefined;
                return (
                  <tr key={row.id} className={on ? 'bg-slate-50' : ''}>
                    <td>
                      <input type="checkbox" checked={on} onChange={() => toggle(row)} aria-label={`Select order ${row.orderNo}`} />
                    </td>
                    <td>
                      <Link href={`/orders/${row.orderNo}`} className="ops-code text-[13px] font-semibold text-slate-900 hover:underline">
                        #{row.orderNo}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {row.customer}
                        {row.deliveredAt ? ` · delivered ${format(new Date(row.deliveredAt), 'dd MMM')}` : ''}
                      </p>
                    </td>
                    <td>
                      <p className="text-[13px] text-slate-900">{PROVIDER_LABEL[row.provider] || row.provider}</p>
                      <p className="ops-code text-xs text-slate-500">{row.consignmentId || '—'}</p>
                    </td>
                    <td className="text-right tabular-nums text-slate-700">{money(row.codCollected)}</td>
                    <td className="hidden text-right tabular-nums text-slate-500 md:table-cell">
                      {row.deliveryFee == null ? '—' : money(row.deliveryFee)}
                    </td>
                    <td className="text-right">
                      <span className="font-semibold tabular-nums text-slate-900">{money(row.outstanding)}</span>
                      {row.remittanceStatus === 'short' ? (
                        <Pill tone="warn" className="ml-1.5">
                          Short
                        </Pill>
                      ) : null}
                    </td>
                    <td className="text-right">
                      {on ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={selected[row.id]}
                          onChange={(event) => setSelected((current) => ({ ...current, [row.id]: event.target.value }))}
                          className={`${fieldClass} ml-auto w-28 text-right tabular-nums`}
                          aria-label={`Amount received for order ${row.orderNo}`}
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow colSpan={7} icon={MdPayments} title="Nothing owed" hint="Consignments appear here once a courier delivers a cash-on-delivery parcel." />
            )}
          </tbody>
        </GlobalTable>
      </section>

      {chosen.length ? (
        <section
          className="card-ui sticky bottom-3 z-10 space-y-4 p-4 shadow-lg sm:p-5"
          aria-label="Record the payout"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Payout reference" hint="The courier's payment or invoice number" optional>
              <input value={reference} onChange={(event) => setReference(event.target.value)} className={fieldClass} />
            </Field>
            <Field label="Arrived as">
              <select value={via} onChange={(event) => setVia(event.target.value)} className={fieldClass}>
                <option value="other">Bank or mobile transfer</option>
                <option value="cash">Cash to HQ</option>
              </select>
            </Field>
            {via === 'other' ? (
              <Field label="Into account" optional>
                <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. City Bank 1234" className={fieldClass} />
              </Field>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-slate-600">
              {chosen.length} consignment{chosen.length === 1 ? '' : 's'} · expected <span className="font-semibold tabular-nums text-slate-900">{money(expecting)}</span>
              {shortBy > 0.005 ? (
                <span className="ml-1 font-medium text-amber-800">· {money(shortBy)} short — the rest stays on this list</span>
              ) : null}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelected({})} disabled={saving} className="btn-ghost">
                Clear selection
              </button>
              <button type="button" onClick={() => mutate()} disabled={saving} className="btn-brand">
                {saving ? 'Recording…' : `Record ${money(receiving)} received`}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
