'use client';

/**
 * The stock ledger — every reason a number changed, and where the stock came
 * from in the first place.
 *
 * It used to answer only the first half: a type, a quantity, a branch. That
 * tells you something moved but not what anyone opens this screen to find out —
 * was this made or was it bought, and against which batch or which purchase.
 * The reference was in the database the whole time as a bare id and was never
 * shown.
 *
 * Two different facts are now on every row and they are deliberately not merged:
 *
 *   Movement  — what happened here. A transfer out is a transfer out.
 *   Origin    — where the units were born. A bag transferred between branches
 *               is still a purchased bag, and stays labelled as one.
 *
 * Sign is carried by colour and an explicit + / − rather than by the reader
 * remembering which movement types are outward.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import { FiArrowRight, FiList, FiRefreshCw } from 'react-icons/fi';

import { adminGetBranches, getInventoryTransactions } from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { EmptyRow, PageBar, Pill, Section, Toolbar, oid, qty } from 'src/components/_admin/ui/primitives';
import { variationLabel } from './shared';

/**
 * Movement types in the operator's words, with the direction they imply.
 * `hold` means the quantity stayed but stopped being sellable.
 */
const MOVEMENT = {
  PRODUCTION_RECEIPT: { label: 'Made', tone: 'good', dir: 'in' },
  PURCHASE_RECEIPT: { label: 'Bought in', tone: 'good', dir: 'in' },
  OPENING_STOCK: { label: 'Opening stock', tone: 'neutral', dir: 'in' },
  TRANSFER_IN: { label: 'Transfer in', tone: 'info', dir: 'in' },
  TRANSFER_OUT: { label: 'Transfer out', tone: 'warn', dir: 'out' },
  SALE: { label: 'Sold', tone: 'violet', dir: 'out' },
  RETURN: { label: 'Returned', tone: 'info', dir: 'in' },
  RESERVATION: { label: 'Reserved', tone: 'warn', dir: 'hold' },
  RESERVATION_RELEASE: { label: 'Reservation released', tone: 'neutral', dir: 'hold' },
  ADJUSTMENT: { label: 'Adjustment', tone: 'bad', dir: 'either' }
};

/** The filter the question is actually asked in: made, or bought. */
const SOURCES = {
  PRODUCTION: 'Production',
  PURCHASE: 'Purchases',
  TRANSFER: 'Transfers',
  SALE: 'Sales',
  RETURN: 'Returns',
  ADJUSTMENT: 'Adjustments',
  OPENING: 'Opening stock'
};

/** How a lot's origin reads once the units have moved on from it. */
const ORIGIN = {
  PRODUCTION: { label: 'Made', tone: 'good' },
  PURCHASE: { label: 'Bought', tone: 'brand' },
  TRANSFER: { label: 'Transferred', tone: 'info' },
  OPENING: { label: 'Opening', tone: 'neutral' },
  ADJUSTMENT: { label: 'Adjusted', tone: 'neutral' },
  RETURN: { label: 'Returned', tone: 'info' }
};

/** Where a resolved reference points, so its number is a link and not a label. */
const REFERENCE_HREF = {
  purchase: (id) => `/purchases/${id}`,
  transfer: () => '/inventory/transfers',
  production: (id) => `/production/batches/${id}`
};

const LIMITS = [50, 100, 250, 500];

export default function StockMovements() {
  const [filters, setFilters] = useState({ branch: '', source: '', type: '' });
  const [limit, setLimit] = useState(100);

  const patch = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const branchesQuery = useQuery('inventory-branches', adminGetBranches);
  // Filtering happens on the server now: a `source` covers several movement
  // types, and filtering a truncated page in the browser would silently answer
  // "no purchases" whenever the last 100 movements happened to be sales.
  const movementsQuery = useQuery(['inventory-transactions', filters, limit], () =>
    getInventoryTransactions({
      limit,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
    })
  );

  const branches = branchesQuery.data?.data || [];
  const rows = movementsQuery.data?.data || [];

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Inventory"
        title="Stock movements"
        subtitle="Every change to a stock figure, newest first — with what it was made or bought against."
      >
        <button type="button" onClick={() => movementsQuery.refetch()} className="btn-ghost">
          <FiRefreshCw size={14} className={movementsQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </PageBar>

      <Section
        title="Ledger"
        icon={FiList}
        hint={`${rows.length} of ${movementsQuery.data?.total ?? 0} movement${rows.length === 1 ? '' : 's'}`}
        actions={
          <Toolbar>
            <select value={filters.branch} onChange={(event) => patch('branch', event.target.value)} className="select-ui" aria-label="Filter by branch">
              <option value="">All branches</option>
              {branches.map((entry) => (
                <option key={oid(entry)} value={oid(entry)}>
                  {entry.name}
                </option>
              ))}
            </select>
            <select
              value={filters.source}
              onChange={(event) => {
                patch('source', event.target.value);
                // A type inside the old source would contradict the new one.
                patch('type', '');
              }}
              className="select-ui"
              aria-label="Filter by where the movement came from"
            >
              <option value="">All sources</option>
              {Object.entries(SOURCES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={filters.type} onChange={(event) => patch('type', event.target.value)} className="select-ui" aria-label="Filter by movement type">
              <option value="">All movements</option>
              {Object.entries(MOVEMENT).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="select-ui"
              aria-label="How many rows to load"
            >
              {LIMITS.map((value) => (
                <option key={value} value={value}>
                  Last {value}
                </option>
              ))}
            </select>
          </Toolbar>
        }
      >
        <GlobalTable>
          <thead>
            <tr>
              <th>When</th>
              <th>Movement</th>
              <th>Product</th>
              <th>Origin</th>
              <th>Against</th>
              <th>Where</th>
              <th className="text-right">Quantity</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {movementsQuery.isLoading ? (
              <EmptyRow colSpan={8} title="Loading movements…" />
            ) : rows.length ? (
              rows.map((row) => {
                const meta = MOVEMENT[row.type] || { label: row.type, tone: 'neutral', dir: 'either' };
                const amount = Number(row.quantity || 0);
                const outward = meta.dir === 'out' || (meta.dir === 'either' && amount < 0);
                const origin = ORIGIN[row.originSource];
                const href = row.reference ? REFERENCE_HREF[row.reference.kind]?.(row.reference.id) : null;
                return (
                  <tr key={oid(row)}>
                    <td className="whitespace-nowrap text-[11px] text-slate-500">
                      {row.createdAt ? format(new Date(row.createdAt), 'dd MMM, hh:mm a') : '—'}
                    </td>
                    <td>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </td>
                    <td>
                      <p className="font-medium text-slate-800">{row.product?.name || 'Unknown product'}</p>
                      {row.variation ? (
                        <p className="text-[11px] text-slate-400">{variationLabel(row.variation)}</p>
                      ) : null}
                    </td>
                    <td>
                      {origin ? (
                        <Pill tone={origin.tone}>{origin.label}</Pill>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                    <td>
                      {row.reference ? (
                        <>
                          {href ? (
                            <Link href={href} className="ops-code text-[12px] font-bold text-[var(--brand-strong)] hover:underline">
                              {row.reference.label}
                            </Link>
                          ) : (
                            <span className="ops-code text-[12px] font-bold text-slate-700">{row.reference.label}</span>
                          )}
                          {row.reference.detail ? (
                            <p className="truncate text-[11px] text-slate-400">{row.reference.detail}</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        {row.branch?.name || '—'}
                        {row.destinationBranch ? (
                          <>
                            <FiArrowRight size={12} className="text-slate-300" />
                            {row.destinationBranch.name}
                          </>
                        ) : null}
                      </span>
                    </td>
                    <td
                      className={`text-right text-[13px] font-bold tabular-nums ${
                        meta.dir === 'hold' ? 'text-slate-500' : outward ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {meta.dir === 'hold' ? '' : outward ? '−' : '+'}
                      {qty(Math.abs(amount))}
                    </td>
                    <td className="text-[12px] text-slate-600">{row.performedBy?.name || 'System'}</td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow colSpan={8} icon={FiList} title="No movements" hint="Nothing has moved under these filters." />
            )}
          </tbody>
        </GlobalTable>
      </Section>
    </div>
  );
}
