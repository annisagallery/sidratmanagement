'use client';

/**
 * Every purchase, newest first — the old POS's purchase list.
 *
 * Its columns are the ones that list had, because they are the questions a
 * buyer actually asks it: when, which challan, where to, how much, how much of
 * that is paid, and what is still owed. Balance is a column rather than a
 * calculation the reader does, since chasing what is owed is most of what this
 * screen is opened for.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import { FiPlus, FiRefreshCw, FiSearch, FiShoppingBag, FiTruck } from 'react-icons/fi';

import { adminGetBranches, getPurchases } from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import {
  EmptyRow,
  PageBar,
  Section,
  StatTile,
  Toolbar,
  money,
  oid,
  qty
} from 'src/components/_admin/ui/primitives';
import { PURCHASE_STATUS, PAYMENT_STATUS, PaymentStatusPill, PurchaseStatusPill, dueOf, outstandingUnits } from './shared';

export default function PurchaseList() {
  const router = useRouter();
  const [filters, setFilters] = useState({ search: '', status: '', paymentStatus: '', branch: '' });
  const [page, setPage] = useState(1);

  const patch = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const purchasesQuery = useQuery(['purchases', filters, page], () =>
    getPurchases({
      page,
      limit: 20,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
    })
  );
  const branchesQuery = useQuery('inventory-branches', adminGetBranches);

  const rows = purchasesQuery.data?.data || [];
  const branches = branchesQuery.data?.data || [];
  const pages = purchasesQuery.data?.count || 1;

  // Totals for the page in view, not for all time — this is a working list, and
  // a lifetime figure here would be a number nobody could act on.
  const pageTotal = rows.reduce((sum, row) => sum + Number(row.grandTotal || 0), 0);
  const pageDue = rows.reduce((sum, row) => sum + dueOf(row), 0);
  const awaiting = rows.filter((row) => outstandingUnits(row) > 0 && row.status !== 'CANCELLED').length;

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Inventory"
        title="Purchases"
        subtitle="Stock bought in finished — bags, and anything else the workshop does not make."
      >
        <button type="button" onClick={() => purchasesQuery.refetch()} className="btn-ghost">
          <FiRefreshCw size={14} className={purchasesQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
        <Link href="/purchases/create" className="btn-brand">
          <FiPlus size={15} /> Add purchase
        </Link>
      </PageBar>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="On this page" value={money(pageTotal)} note={`${rows.length} purchase${rows.length === 1 ? '' : 's'}`} />
        <StatTile label="Still owed" value={money(pageDue)} tone={pageDue > 0 ? 'warn' : 'good'} note="Across the purchases shown" />
        <StatTile
          label="Awaiting delivery"
          value={qty(awaiting)}
          tone={awaiting > 0 ? 'info' : 'muted'}
          note="Purchases with units still to arrive"
        />
      </div>

      <Section
        title="All purchases"
        icon={FiShoppingBag}
        hint={`${purchasesQuery.data?.total ?? 0} on file`}
        actions={
          <Toolbar>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={filters.search}
                onChange={(event) => patch('search', event.target.value)}
                placeholder="PO number, challan or note…"
                className="input-ui w-56 pl-8"
                aria-label="Search purchases"
              />
            </div>
            <select value={filters.status} onChange={(event) => patch('status', event.target.value)} className="select-ui" aria-label="Filter by purchase status">
              <option value="">All statuses</option>
              {Object.entries(PURCHASE_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
            <select
              value={filters.paymentStatus}
              onChange={(event) => patch('paymentStatus', event.target.value)}
              className="select-ui"
              aria-label="Filter by payment status"
            >
              <option value="">All payments</option>
              {Object.entries(PAYMENT_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
            <select value={filters.branch} onChange={(event) => patch('branch', event.target.value)} className="select-ui" aria-label="Filter by warehouse">
              <option value="">All warehouses</option>
              {branches.map((branch) => (
                <option key={oid(branch)} value={oid(branch)}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Toolbar>
        }
      >
        <GlobalTable>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Warehouse</th>
              <th>Status</th>
              <th className="text-right">Grand total</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Balance</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {purchasesQuery.isLoading ? (
              <EmptyRow colSpan={8} title="Loading purchases…" />
            ) : rows.length ? (
              rows.map((row) => {
                const due = dueOf(row);
                const outstanding = outstandingUnits(row);
                return (
                  <tr
                    key={oid(row)}
                    onClick={() => router.push(`/purchases/${oid(row)}`)}
                    className="cursor-pointer transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap text-[12px] text-slate-500">
                      {row.date ? format(new Date(row.date), 'dd MMM yyyy') : '—'}
                    </td>
                    <td>
                      <p className="ops-code text-[12px] font-bold text-slate-800">{row.purchaseNo}</p>
                      {row.refNo ? <p className="text-[11px] text-slate-400">{row.refNo}</p> : null}
                    </td>
                    <td className="text-slate-600">{row.branch?.name || '—'}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PurchaseStatusPill status={row.status} />
                        {outstanding > 0 && row.status !== 'CANCELLED' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            <FiTruck size={11} /> {qty(outstanding)} due
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-right font-semibold tabular-nums text-slate-800">{money(row.grandTotal)}</td>
                    <td className="text-right tabular-nums text-slate-600">{money(row.paidAmount)}</td>
                    <td className={`text-right font-bold tabular-nums ${due > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {money(due)}
                    </td>
                    <td>
                      <PaymentStatusPill status={row.paymentStatus} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow
                colSpan={8}
                icon={FiShoppingBag}
                title="No purchases yet"
                hint="Raise one when you order stock the workshop does not make."
              />
            )}
          </tbody>
        </GlobalTable>

        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-[12px] text-slate-500">
            <span>
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost h-8 !text-xs">
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="btn-ghost h-8 !text-xs"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </Section>
    </div>
  );
}
