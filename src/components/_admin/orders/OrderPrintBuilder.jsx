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
import SearchInput from 'src/components/_admin/ui/SearchInput';
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
    <div className="space-y-6">
      <PageBar eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <button type="button" onClick={() => ordersQuery.refetch()} className="btn-ghost">
          <FiRefreshCw size={15} aria-hidden className={ordersQuery.isFetching ? 'animate-spin' : ''} /> Refresh
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
              <SearchInput
                className="w-60"
                placeholder="Order no, name or phone"
                label="Search orders"
                onSearch={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
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
              <button type="button" onClick={addPage} disabled={!orders.length} className="btn-ghost btn-sm">
                Add page
              </button>
            </Toolbar>
          }
        >
          <GlobalTable>
            <caption className="sr-only">Orders to choose from</caption>
            <thead>
              <tr>
                <th className="w-10">
                  <span className="sr-only">Selected</span>
                </th>
                <th>Order</th>
                <th>Recipient</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ordersQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`loading-${i}`} aria-hidden>
                    <td colSpan={5}>
                      <div className="skeleton h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : orders.length ? (
                orders.map((order) => {
                  const on = Boolean(picked[order.orderNo]);
                  return (
                    <tr
                      key={order.orderNo}
                      onClick={() => toggle(order)}
                      className={`cursor-pointer ${on ? '!bg-slate-50' : ''}`}
                    >
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(order)}
                          aria-label={`Select order ${order.orderNo}`}
                          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                        />
                      </td>
                      <td>
                        <span className="ops-code text-[13px] font-semibold text-slate-900">#{order.orderNo}</span>
                        <span className="block text-xs text-slate-500">
                          {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '—'}
                        </span>
                      </td>
                      <td>
                        <p className="text-[13px] font-medium text-slate-900">{orderRecipient(order)}</p>
                        <p className="ops-code text-xs text-slate-500">{orderPhone(order)}</p>
                      </td>
                      <td>
                        <Pill tone="neutral">{String(order.status || '').replaceAll('-', ' ')}</Pill>
                      </td>
                      <td className="text-right text-[13px] font-semibold tabular-nums text-slate-900">
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
          <Pagination
            page={page}
            totalPages={ordersQuery.data?.count || 1}
            onPage={setPage}
            total={ordersQuery.data?.total || 0}
            unit="orders"
            pageSize={LIMIT}
          />
        </Section>

        <aside className="space-y-4 xl:sticky xl:top-0">
          <Section
            title="To print"
            icon={FiPrinter}
            hint={`${selected.length} order${selected.length === 1 ? '' : 's'}`}
            actions={
              selected.length ? (
                <button type="button" onClick={() => setPicked({})} className="btn-quiet btn-sm">
                  <FiTrash2 size={14} aria-hidden /> Clear all
                </button>
              ) : null
            }
          >
            <SectionBody className="max-h-[420px] overflow-y-auto p-0">
              <ul className="divide-y divide-slate-100">
                {selected.map((order) => (
                  <li key={order.orderNo} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="ops-code truncate text-[13px] font-semibold text-slate-900">#{order.orderNo}</p>
                      <p className="truncate text-xs text-slate-500">{orderRecipient(order)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(order)}
                      aria-label={`Remove order ${order.orderNo}`}
                      className="btn-icon btn-icon-sm btn-icon-danger"
                    >
                      <FiX size={14} />
                    </button>
                  </li>
                ))}
                {!selected.length ? (
                  <li className="px-6 py-12 text-center text-[13px] text-slate-500">
                    Nothing selected yet. Select orders from the list.
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
                  {Icon ? <Icon size={16} aria-hidden /> : null}
                  {running ? action.busyLabel || 'Working…' : `${action.label} (${selected.length})`}
                </button>
              );
            })}
            {actions[0]?.hint ? (
              <p className="text-center text-xs text-slate-500">{actions[0].hint}</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
