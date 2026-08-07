'use client';

/**
 * Pick orders, then print them.
 *
 * Both print sheets — shipping labels and invoices — were reachable only as a
 * bulk action on the orders list, which meant printing was something you did
 * *while* working the queue rather than a job of its own. A dispatch run is a
 * job of its own: you come to it knowing you need today's labels, and you want
 * a basket you can add to across several searches without losing your place.
 *
 * So this is the same shape as the barcode label builder: search on the left,
 * a basket that survives changing the search, and one button that produces the
 * artefact. What that artefact is belongs to the caller — this owns choosing.
 */

import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import { FiPrinter, FiRefreshCw, FiSearch, FiTrash2, FiX } from 'react-icons/fi';

import * as api from 'src/services';
import useStickyState from 'src/hooks/useStickyState';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import {
  EmptyRow,
  PageBar,
  Pill,
  Section,
  SectionBody,
  StatTile,
  Toolbar,
  money,
  qty
} from 'src/components/_admin/ui/primitives';

const LIMIT = 20;
const BASKET_KEY = 'admin:print-basket';

/** Whatever the order calls its recipient. */
export const orderRecipient = (order) =>
  order?.shippingAddress?.name || order?.guestName || order?.user?.name || 'Customer';

export const orderPhone = (order) =>
  order?.shippingAddress?.phone || order?.guestPhone || order?.user?.phone || '';

/**
 * The slice of an order the basket needs, and nothing else.
 *
 * A list row carries far more than these five lines show, and all of it would
 * otherwise be serialised into localStorage on every tick. Keeping the same
 * nested shapes means `orderRecipient` and `orderPhone` read a restored row
 * exactly as they read a fresh one.
 */
const packRow = (order) => ({
  orderNo: order?.orderNo,
  createdAt: order?.createdAt || null,
  status: order?.status || '',
  total: order?.total ?? 0,
  shippingAddress: {
    name: order?.shippingAddress?.name || '',
    phone: order?.shippingAddress?.phone || ''
  },
  guestName: order?.guestName || '',
  guestPhone: order?.guestPhone || '',
  user: { name: order?.user?.name || '', phone: order?.user?.phone || '' }
});

export default function OrderPrintBuilder({
  eyebrow,
  title,
  subtitle,
  stats,
  /** [{ key, label, icon, tone, hint, onClick }] — rendered under the basket. */
  actions = [],
  busyKey = null,
  notice = null
}) {
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // Keyed by orderNo — the whole row is kept so the basket can be shown without
  // re-querying, and so a selection survives a search that no longer matches it.
  //
  // Persisted, because assembling a dispatch run takes minutes and any
  // navigation away used to discard it. Only the display fields are stored; the
  // print itself re-fetches every order in full, so a row that has gone stale
  // in storage can never reach a printed document.
  const [picked, setPicked] = useStickyState(BASKET_KEY, {});

  const params = useMemo(
    () =>
      new URLSearchParams({
        page,
        limit: LIMIT,
        channel: 'orders',
        ...(search ? { search } : {}),
        ...(status ? { status } : {})
      }).toString(),
    [page, search, status]
  );

  const ordersQuery = useQuery(['print-builder-orders', params], () => api.getOrdersByAdmin(params), {
    keepPreviousData: true
  });
  const orders = ordersQuery.data?.data || [];

  const selected = Object.values(picked);

  const toggle = (order) =>
    setPicked((current) => {
      const next = { ...current };
      if (next[order.orderNo]) delete next[order.orderNo];
      else next[order.orderNo] = packRow(order);
      return next;
    });

  const addPage = () =>
    setPicked((current) => ({
      ...current,
      ...Object.fromEntries(orders.filter((order) => order.orderNo).map((order) => [order.orderNo, packRow(order)]))
    }));

  return (
    <div className="space-y-4">
      <PageBar eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <button type="button" onClick={() => ordersQuery.refetch()} className="btn-ghost">
          <FiRefreshCw size={14} className={ordersQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </PageBar>

      {notice}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Selected" value={qty(selected.length)} note="Orders in the basket" tone={selected.length ? 'info' : 'muted'} />
        {stats ? stats(selected) : null}
        <StatTile label="Found" value={qty(ordersQuery.data?.total || 0)} note="Matching this search" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Section
          title="Orders"
          icon={FiSearch}
          hint={`page ${page}`}
          actions={
            <Toolbar>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearch(term.trim());
                  setPage(1);
                }}
                className="relative"
              >
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Order no, name or phone…"
                  className="input-ui w-56 pl-8"
                  aria-label="Search orders"
                />
              </form>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className="select-ui"
                aria-label="Filter by status"
              >
                <option value="">Every status</option>
                <option value="ready-to-pack">Ready to pack</option>
                <option value="packed">Packed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
              <button type="button" onClick={addPage} disabled={!orders.length} className="btn-ghost h-9 !text-xs">
                Add page
              </button>
            </Toolbar>
          }
        >
          <GlobalTable>
            <thead>
              <tr>
                <th className="w-10" />
                <th>Order</th>
                <th>Recipient</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ordersQuery.isLoading ? (
                <EmptyRow colSpan={5} title="Loading orders…" />
              ) : orders.length ? (
                orders.map((order) => {
                  const on = Boolean(picked[order.orderNo]);
                  return (
                    <tr key={order.orderNo} className={on ? 'bg-sky-50/60' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(order)}
                          aria-label={`Select order ${order.orderNo}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td>
                        <span className="ops-code text-[12px] font-bold text-[var(--brand-strong)]">#{order.orderNo}</span>
                        <span className="block text-[11px] text-slate-400">
                          {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '—'}
                        </span>
                      </td>
                      <td>
                        <p className="text-[13px] font-semibold text-slate-800">{orderRecipient(order)}</p>
                        <p className="ops-code text-[11px] text-slate-500">{orderPhone(order)}</p>
                      </td>
                      <td>
                        <Pill tone="neutral">{String(order.status || '').replaceAll('-', ' ')}</Pill>
                      </td>
                      <td className="text-right tabular-nums text-[13px] font-semibold text-slate-700">
                        {money(order.total)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <EmptyRow colSpan={5} icon={FiSearch} title="No orders match" hint="Try a different search or status." />
              )}
            </tbody>
          </GlobalTable>
        </Section>

        <aside className="space-y-4 xl:sticky xl:top-0">
          <Section
            title="To print"
            icon={FiPrinter}
            hint={`${selected.length} order${selected.length === 1 ? '' : 's'}`}
            actions={
              selected.length ? (
                <button type="button" onClick={() => setPicked({})} className="btn-ghost h-8 !px-2.5 !text-xs">
                  <FiTrash2 size={12} /> Clear
                </button>
              ) : null
            }
          >
            <SectionBody className="max-h-[420px] overflow-y-auto p-0">
              <ul className="divide-y divide-slate-100">
                {selected.map((order) => (
                  <li key={order.orderNo} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="ops-code truncate text-[12px] font-bold text-slate-800">#{order.orderNo}</p>
                      <p className="truncate text-[11px] text-slate-500">{orderRecipient(order)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(order)}
                      aria-label={`Remove order ${order.orderNo}`}
                      className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <FiX size={14} />
                    </button>
                  </li>
                ))}
                {!selected.length ? (
                  <li className="px-6 py-12 text-center text-sm text-slate-400">
                    Nothing selected yet. Tick orders on the left.
                  </li>
                ) : null}
              </ul>
            </SectionBody>
          </Section>

          {/* One basket, three things you can do with it — the point of putting
              labels and invoices on the same desk is that a dispatch run needs
              both for the same orders and picking them twice was the friction. */}
          <div className="space-y-2">
            {actions.map((action, index) => {
              const Icon = action.icon;
              const running = busyKey === action.key;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => action.onClick(selected)}
                  disabled={!selected.length || Boolean(busyKey)}
                  title={action.hint}
                  className={`${index === 0 ? 'btn-brand' : 'btn-ghost'} h-11 w-full`}
                >
                  {Icon ? <Icon size={15} /> : null}
                  {running ? action.busyLabel || 'Working…' : `${action.label} (${selected.length})`}
                </button>
              );
            })}
            {actions[0]?.hint ? (
              <p className="text-center text-[11px] text-slate-400">{actions[0].hint}</p>
            ) : null}
          </div>
        </aside>
      </div>

      <Pagination
        page={page}
        totalPages={ordersQuery.data?.count || 1}
        onPage={setPage}
        total={ordersQuery.data?.total || 0}
        unit="orders"
        pageSize={LIMIT}
      />
    </div>
  );
}
