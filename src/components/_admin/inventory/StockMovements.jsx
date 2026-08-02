'use client';

/**
 * The stock ledger — every reason a number changed.
 *
 * When a count is wrong, this is the screen that says why: what moved, in which
 * direction, at whose hand. Sign is carried by colour and an explicit + / −
 * rather than by the reader remembering which movement types are outward.
 */

import { useMemo, useState } from 'react';
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
  OPENING_STOCK: { label: 'Opening stock', tone: 'neutral', dir: 'in' },
  TRANSFER_IN: { label: 'Transfer in', tone: 'info', dir: 'in' },
  TRANSFER_OUT: { label: 'Transfer out', tone: 'warn', dir: 'out' },
  SALE: { label: 'Sold', tone: 'violet', dir: 'out' },
  RETURN: { label: 'Returned', tone: 'info', dir: 'in' },
  RESERVATION: { label: 'Reserved', tone: 'warn', dir: 'hold' },
  RESERVATION_RELEASE: { label: 'Reservation released', tone: 'neutral', dir: 'hold' },
  ADJUSTMENT: { label: 'Adjustment', tone: 'bad', dir: 'either' }
};

const LIMITS = [50, 100, 250, 500];

export default function StockMovements() {
  const [branch, setBranch] = useState('');
  const [type, setType] = useState('');
  const [limit, setLimit] = useState(100);

  const branchesQuery = useQuery('inventory-branches', adminGetBranches);
  const movementsQuery = useQuery(['inventory-transactions', branch, limit], () =>
    getInventoryTransactions({ limit, ...(branch ? { branch } : {}) })
  );

  const branches = branchesQuery.data?.data || [];
  const rows = useMemo(() => {
    const all = movementsQuery.data?.data || [];
    return type ? all.filter((row) => row.type === type) : all;
  }, [movementsQuery.data, type]);

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Inventory"
        title="Stock movements"
        subtitle="Every change to a stock figure, newest first."
      >
        <button type="button" onClick={() => movementsQuery.refetch()} className="btn-ghost">
          <FiRefreshCw size={14} className={movementsQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </PageBar>

      <Section
        title="Ledger"
        icon={FiList}
        hint={`${rows.length} movement${rows.length === 1 ? '' : 's'}`}
        actions={
          <Toolbar>
            <select value={branch} onChange={(event) => setBranch(event.target.value)} className="select-ui" aria-label="Filter by branch">
              <option value="">All branches</option>
              {branches.map((entry) => (
                <option key={oid(entry)} value={oid(entry)}>
                  {entry.name}
                </option>
              ))}
            </select>
            <select value={type} onChange={(event) => setType(event.target.value)} className="select-ui" aria-label="Filter by movement type">
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
              <th>Where</th>
              <th className="text-right">Quantity</th>
              <th>By</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {movementsQuery.isLoading ? (
              <EmptyRow colSpan={7} title="Loading movements…" />
            ) : rows.length ? (
              rows.map((row) => {
                const meta = MOVEMENT[row.type] || { label: row.type, tone: 'neutral', dir: 'either' };
                const amount = Number(row.quantity || 0);
                const outward = meta.dir === 'out' || (meta.dir === 'either' && amount < 0);
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
                    <td className="max-w-[220px] truncate text-[11px] text-slate-400" title={row.note || ''}>
                      {row.note || '—'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow colSpan={7} icon={FiList} title="No movements" hint="Nothing has moved under these filters." />
            )}
          </tbody>
        </GlobalTable>
      </Section>
    </div>
  );
}
