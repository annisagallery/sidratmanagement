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
import { useMutation, useQuery } from 'react-query';
import { format } from 'date-fns';
import { FiDollarSign } from 'react-icons/fi';

import * as api from 'src/services';
import {
  EmptyRow,
  Field,
  PageBar,
  Pill,
  StatTile,
  Toolbar,
  errorAlert,
  fieldClass,
  money,
  toast
} from 'src/components/_admin/ui/primitives';

const PROVIDER_LABEL = { pathao: 'Pathao', steadfast: 'Steadfast', carrybee: 'CarryBee' };

export default function CodRemittance() {
  const [provider, setProvider] = useState('');
  const [selected, setSelected] = useState({}); // shipmentId -> received amount (string)
  const [reference, setReference] = useState('');
  const [via, setVia] = useState('other');
  const [label, setLabel] = useState('');

  const { data, isLoading, refetch } = useQuery(
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
        toast(short ? `Payout recorded — ${short} consignment${short === 1 ? '' : 's'} still short` : 'Payout recorded');
        setSelected({});
        setReference('');
        refetch();
      },
      onError: (error) => errorAlert('Could not record the payout', error)
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

  return (
    <div className="space-y-4 pb-12">
      <PageBar
        eyebrow="Shipping"
        title="COD payouts"
        subtitle="Cash couriers collected on delivery and have not paid us yet."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Still owed" value={money(totals.outstanding)} tone={totals.outstanding > 0 ? 'warn' : 'good'} />
        <StatTile label="Collected" value={money(totals.collected)} note="Cash taken at the door" />
        <StatTile label="Courier fees" value={money(totals.fees)} note="Deducted from payouts" />
        <StatTile label="Consignments" value={rows.length} note="Awaiting or short" />
      </div>

      <Toolbar>
        <select value={provider} onChange={(event) => setProvider(event.target.value)} className="select-ui h-9 w-44">
          <option value="">All couriers</option>
          {Object.entries(PROVIDER_LABEL).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
              {byProvider[value] ? ` — ${money(byProvider[value])}` : ''}
            </option>
          ))}
        </select>
      </Toolbar>

      <div className="card-ui overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={allChosen} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2.5">Order</th>
              <th className="px-3 py-2.5">Courier</th>
              <th className="px-3 py-2.5 text-right">Collected</th>
              <th className="px-3 py-2.5 text-right">Fee</th>
              <th className="px-3 py-2.5 text-right">Owed</th>
              <th className="px-3 py-2.5 text-right">Received now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <EmptyRow colSpan={7} title="Loading…" />
            ) : rows.length ? (
              rows.map((row) => {
                const on = selected[row.id] !== undefined;
                return (
                  <tr key={row.id} className={on ? 'bg-[var(--brand-soft)]/40' : ''}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={on} onChange={() => toggle(row)} aria-label={`Select ${row.orderNo}`} />
                    </td>
                    <td className="px-3 py-2.5">
                      <a href={`/orders/${row.orderNo}`} className="font-semibold text-slate-800 hover:underline">
                        #{row.orderNo}
                      </a>
                      <p className="text-[11px] text-slate-400">
                        {row.customer}
                        {row.deliveredAt ? ` · ${format(new Date(row.deliveredAt), 'dd MMM')}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-700">{PROVIDER_LABEL[row.provider] || row.provider}</p>
                      <p className="ops-code text-[11px] text-slate-400">{row.consignmentId || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(row.codCollected)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                      {row.deliveryFee == null ? '—' : money(row.deliveryFee)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {money(row.outstanding)}
                      {row.remittanceStatus === 'short' ? (
                        <Pill tone="warn" className="ml-1.5">
                          short
                        </Pill>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {on ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={selected[row.id]}
                          onChange={(event) => setSelected((current) => ({ ...current, [row.id]: event.target.value }))}
                          className={`${fieldClass} !h-8 w-28 text-right tabular-nums`}
                          aria-label={`Received for ${row.orderNo}`}
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow
                colSpan={7}
                icon={FiDollarSign}
                title="Nothing owed"
                hint="Consignments appear here once a courier delivers a COD parcel."
              />
            )}
          </tbody>
        </table>
      </div>

      {chosen.length ? (
        <div className="card-ui sticky bottom-3 grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <Field label="Payout reference" hint="The courier's payment or invoice number">
            <input value={reference} onChange={(event) => setReference(event.target.value)} className={fieldClass} />
          </Field>
          <Field label="Arrived as">
            <select value={via} onChange={(event) => setVia(event.target.value)} className={fieldClass}>
              <option value="other">Bank / mobile transfer</option>
              <option value="cash">Cash to HQ</option>
            </select>
          </Field>
          {via === 'other' ? (
            <Field label="Account">
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. City Bank 1234"
                className={fieldClass}
              />
            </Field>
          ) : (
            <div />
          )}
          <div className="text-right">
            <p className="text-xs text-slate-500">
              {chosen.length} consignment{chosen.length === 1 ? '' : 's'} · expected {money(expecting)}
            </p>
            <button type="button" onClick={() => mutate()} disabled={saving} className="btn-brand mt-1 h-10">
              {saving ? 'Recording…' : `Record ${money(receiving)} received`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
