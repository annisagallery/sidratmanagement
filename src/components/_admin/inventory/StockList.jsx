'use client';

/**
 * Stock — what we have, and what is actually sellable.
 *
 * The screen answers one question in its first line: how much can we sell right
 * now. Everything else is a way of narrowing that. The four tiles are also the
 * filters, because "show me what is out of stock" is the same thought as "how
 * many are out of stock" and should not need a second control.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from 'react-query';
import { FiChevronRight, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { MdOutlineInventory2 } from 'react-icons/md';

import { adminGetBranches, getProductStockList } from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { EmptyRow, PageBar, Section, StatTile, Toolbar, oid, qty } from 'src/components/_admin/ui/primitives';
import { StockPill, availableOf, stockState } from './shared';

const FILTERS = {
  all: () => true,
  ok: (row) => stockState(row.available).key === 'ok',
  low: (row) => stockState(row.available).key === 'low',
  out: (row) => stockState(row.available).key === 'out'
};

export default function StockList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [filter, setFilter] = useState('all');

  const branchesQuery = useQuery('inventory-branches', adminGetBranches);
  const stockQuery = useQuery(['inventory-product-stock', branch], () =>
    getProductStockList({ showAll: 'true', ...(branch ? { branch } : {}) })
  );

  const branches = branchesQuery.data?.data || [];

  // The endpoint groups by product; `available` is derived once here so the
  // tiles, the filter and the table can never disagree about it.
  const rows = useMemo(
    () =>
      (stockQuery.data?.data || []).map((entry) => ({
        id: String(entry._id || entry.id || ''),
        product: entry.product,
        onHand: Number(entry.totalOnHand || 0),
        reserved: Number(entry.totalReserved || 0),
        available: availableOf(entry.totalOnHand, entry.totalReserved)
      })),
    [stockQuery.data]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          onHand: acc.onHand + row.onHand,
          reserved: acc.reserved + row.reserved,
          available: acc.available + row.available,
          low: acc.low + (stockState(row.available).key === 'low' ? 1 : 0),
          out: acc.out + (stockState(row.available).key === 'out' ? 1 : 0)
        }),
        { onHand: 0, reserved: 0, available: 0, low: 0, out: 0 }
      ),
    [rows]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(
      (row) =>
        FILTERS[filter](row) &&
        (!term ||
          row.product?.name?.toLowerCase().includes(term) ||
          String(row.product?.code || '').includes(term))
    );
  }, [rows, search, filter]);

  const toggle = (key) => setFilter((current) => (current === key ? 'all' : key));

  return (
    <div className="space-y-4">
      <PageBar
        title="Stock"
        subtitle="Production lands at HQ; transfers move quantity between branches."
        eyebrow="Inventory"
      >
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries('inventory-product-stock')}
          className="btn-ghost"
        >
          <FiRefreshCw size={14} /> Refresh
        </button>
      </PageBar>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Available to sell" value={qty(totals.available)} note="On hand minus reserved" tone="good" />
        <StatTile label="On hand" value={qty(totals.onHand)} note={`${rows.length} products`} />
        <StatTile
          label="Reserved"
          value={qty(totals.reserved)}
          note="Promised to open orders"
          tone="warn"
        />
        <StatTile
          label="Needs attention"
          value={qty(totals.out + totals.low)}
          note={`${totals.out} out · ${totals.low} low`}
          tone={totals.out ? 'bad' : 'muted'}
          onClick={() => toggle('out')}
          active={filter === 'out'}
        />
      </div>

      <Section
        title="Products"
        icon={MdOutlineInventory2}
        hint={`${visible.length} shown`}
        actions={
          <Toolbar>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or code…"
                className="input-ui w-56 pl-8"
                aria-label="Search products"
              />
            </div>
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className="select-ui"
              aria-label="Filter by branch"
            >
              <option value="">All branches</option>
              {branches.map((entry) => (
                <option key={oid(entry)} value={oid(entry)}>
                  {entry.name}
                </option>
              ))}
            </select>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="select-ui"
              aria-label="Filter by stock level"
            >
              <option value="all">Every product</option>
              <option value="ok">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </Toolbar>
        }
      >
        <GlobalTable>
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">On hand</th>
              <th className="text-right">Reserved</th>
              <th className="text-right">Available</th>
              <th>State</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {stockQuery.isLoading ? (
              <EmptyRow colSpan={6} title="Loading stock…" />
            ) : visible.length ? (
              visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/inventory/products/${row.id}`} className="block">
                      <p className="font-semibold text-slate-800 hover:underline">{row.product?.name}</p>
                      <p className="ops-code text-[11px] text-slate-400">#{row.product?.code}</p>
                    </Link>
                  </td>
                  <td className="text-right tabular-nums text-slate-700">{qty(row.onHand)}</td>
                  <td className="text-right tabular-nums text-amber-700">{qty(row.reserved)}</td>
                  <td className="text-right">
                    <span
                      className={`text-[13px] font-bold tabular-nums ${
                        row.available === 0 ? 'text-rose-600' : row.available < 5 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {qty(row.available)}
                    </span>
                  </td>
                  <td>
                    <StockPill available={row.available} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/inventory/products/${row.id}`}
                      aria-label={`Open ${row.product?.name}`}
                      className="inline-flex rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <FiChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow
                colSpan={6}
                icon={MdOutlineInventory2}
                title="No products match"
                hint="Clear the search or choose a different stock level."
              />
            )}
          </tbody>
        </GlobalTable>
      </Section>
    </div>
  );
}
