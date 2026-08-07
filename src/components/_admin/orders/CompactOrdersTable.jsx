'use client';

import Link from 'next/link';
import { MdArrowDownward, MdArrowUpward, MdChevronRight, MdInbox, MdUnfoldMore } from 'react-icons/md';

import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState, TableSkeleton } from 'src/components/_admin/ui/TableStates';
import { BulkActionBar, SelectionCheckbox, useBulkSelection } from 'src/components/_admin/ui/bulkSelection';
import { StatusBadge } from 'src/components/_admin/shared/StatusBadge';
import { fDate, fDateTime } from 'src/utils/formatTime';

/**
 * The detailed orders view — one row per order item, grouped by order.
 *
 * Two things it gets wrong if you are not careful, both fixed here:
 *
 *  - It used to declare `min-w-[1740px]` and a `min-w` on every cell, which
 *    forced a horizontal scrollbar on any screen narrower than a very wide
 *    desktop. Nothing needed those widths; they only stopped text wrapping.
 *    The table now sizes to its container and wraps, so the view fits.
 *
 *  - It could not select anything. The summary view has bulk actions, so
 *    switching to the view that shows you the most took away your ability to
 *    act on it. It now shares the summary view's selection machinery rather
 *    than carrying a second copy of it — see ui/bulkSelection.
 */

const money = (amount) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);

const date = (value) => (value ? fDate(value) : '—');
const dateTime = (value) => (value ? fDateTime(value) : '—');
const valueOrDash = (value) => (value === 0 || value ? value : '—');

const itemName = (item) => item.pid?.name || item.product?.name || item.productSnapshot?.name || 'Unknown product';

const itemCode = (item) =>
  item.packingBarcode || item.assignedUnit?.barcode || item.productSnapshot?.code || item.pid?.code || null;

/**
 * The variation, the way a picker says it: values only, slash-separated.
 *
 * Was one bordered chip per attribute, each prefixed with its attribute name
 * ("Colour: Rose", "Fabric: Soft China Georgette"). That is three lines of
 * chrome to say "Rose / Soft China Georgette Fabric / R", and it was the single
 * widest thing in the table.
 */
const itemVariant = (item) =>
  (item.attributes || [])
    .map((attribute) => attribute.valueName)
    .filter(Boolean)
    .join(' / ');

const sourceLabel = (order) => {
  if (order.source === 'showroom') return 'Showroom';
  const dueGap =
    order.estimatedDelivery && order.createdAt
      ? new Date(order.estimatedDelivery).getTime() - new Date(order.createdAt).getTime()
      : 0;
  if (order.source === 'pos' && dueGap > 60 * 60 * 1000) return 'Showroom';
  return { online: 'Online', admin: 'CC', pos: 'POS' }[order.source] || 'Online';
};

function Tags({ tags = [] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id || tag.slug || tag.name}
          className="rounded border px-1 py-px text-[9px] font-semibold"
          style={{
            backgroundColor: tag.color ? `${tag.color}18` : '#f1f5f9',
            borderColor: tag.color ? `${tag.color}55` : '#cbd5e1',
            color: tag.color || '#475569'
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

/** Order identity, and the small metadata that used to need its own column. */
function OrderCell({ order }) {
  return (
    <div>
      <Link
        href={`/orders/${order.orderNo}`}
        className="font-mono text-[12px] font-extrabold text-slate-900 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
      >
        #{order.orderNo}
      </Link>
      <p className="mt-0.5 text-[10px] text-slate-500">{dateTime(order.createdAt)}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {sourceLabel(order)} · {order.deliveryType || 'regular'}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-400">
        {order.createdBy?.name || (order.source === 'online' ? 'Customer' : 'Unknown')}
        {order.branch?.name ? ` · ${order.branch.name}` : ''}
      </p>
    </div>
  );
}

function CustomerCell({ order }) {
  const address = order.shippingAddress || {};
  const phone = address.phone || order.user?.phone;
  const location = [address.address, address.upazila, address.district].filter(Boolean).join(', ');
  return (
    <div>
      <p className="font-semibold leading-4 text-slate-900">{address.name || order.user?.name || 'Guest customer'}</p>
      {phone ? (
        <Link href={`/users/${encodeURIComponent(phone)}`} className="mt-0.5 block text-[11px] font-medium text-slate-600 hover:underline">
          {phone}
        </Link>
      ) : (
        <p className="mt-0.5 text-[11px] text-slate-400">No phone</p>
      )}
      <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{location || 'No delivery address'}</p>
    </div>
  );
}

function FulfillmentCell({ order, statuses }) {
  return (
    <div>
      <StatusBadge status={order.status} statuses={statuses} />
      <p className="mt-1 text-[10px] font-semibold text-slate-500">Due {date(order.estimatedDelivery)}</p>
    </div>
  );
}

/** NAME on one line, the variation on the next. Nothing else. */
function ItemCell({ item }) {
  const variant = itemVariant(item);
  return (
    <div>
      <p className="font-semibold leading-4 text-slate-900">{itemName(item)}</p>
      {variant ? <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{variant}</p> : null}
      {item.customizeDetails ? (
        <p className="mt-0.5 text-[10px] leading-4 text-amber-800">Custom: {item.customizeDetails}</p>
      ) : item.isCustom ? (
        <p className="mt-0.5 text-[10px] font-semibold text-amber-800">Custom item</p>
      ) : null}
    </div>
  );
}

function ItemStateCell({ item, itemStatuses }) {
  const code = itemCode(item);
  return (
    <div>
      <StatusBadge status={item.status} statuses={itemStatuses} />
      {code ? <p className="mt-1 font-mono text-[10px] font-semibold text-slate-600">{code}</p> : null}
      {item.deliveryDate ? <p className="mt-0.5 text-[10px] text-slate-500">Due {date(item.deliveryDate)}</p> : null}
    </div>
  );
}

/** What was charged and what has been paid, in one column instead of two. */
function MoneyCell({ order }) {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const totalDiscount = (Number(order.discount) || 0) + (Number(order.cashDiscount) || 0);
  return (
    <div className="text-[10px] tabular-nums">
      <div className="flex justify-between gap-2 text-[12px] font-extrabold text-slate-900">
        <span>Total</span>
        <span>{money(order.total)}</span>
      </div>
      <div className="mt-0.5 flex justify-between gap-2 text-slate-500">
        <span>Sub</span>
        <span>{money(order.subTotal)}</span>
      </div>
      {totalDiscount > 0 ? (
        <div className="flex justify-between gap-2 text-slate-500">
          <span>Disc</span>
          <span>-{money(totalDiscount)}</span>
        </div>
      ) : null}
      {(Number(order.shipping) || 0) > 0 ? (
        <div className="flex justify-between gap-2 text-slate-500">
          <span>Ship</span>
          <span>{money(order.shipping)}</span>
        </div>
      ) : null}
      {(Number(order.vat) || 0) > 0 ? (
        <div className="flex justify-between gap-2 text-slate-500">
          <span>VAT</span>
          <span>{money(order.vat)}</span>
        </div>
      ) : null}
      <p className="mt-1 border-t border-slate-300/70 pt-1 font-semibold capitalize text-slate-700">
        {order.paymentStatus || 'Not set'}
        <span className="ml-1 font-normal uppercase text-slate-500">{order.paymentMethod || ''}</span>
      </p>
      {payments.map((payment, index) => (
        <p key={payment.id || payment._id || index} className="text-[9px] leading-4 text-slate-500">
          <span className="capitalize">{payment.method}</span> {money(payment.amount)}
        </p>
      ))}
      {order.couponCode ? <p className="text-[9px] font-semibold text-slate-500">Coupon {order.couponCode}</p> : null}
    </div>
  );
}

function ContextCell({ order }) {
  return (
    <div>
      <Tags tags={order.tags} />
      {order.note ? <p className="mt-1 text-[10px] leading-4 text-slate-600">{order.note}</p> : null}
      {!order.tags?.length && !order.note ? <span className="text-[10px] text-slate-400">—</span> : null}
    </div>
  );
}

function CompactHeader({ label, field, sort, align = 'left', className = '' }) {
  const active = field && sort?.by === field;
  const alignment = align === 'right' ? 'text-right' : 'text-left';

  if (!field) {
    return (
      <th scope="col" className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wider ${alignment} ${className}`}>
        {label}
      </th>
    );
  }

  return (
    <th scope="col" className={`px-2 py-2 ${alignment} ${className}`}>
      <button
        type="button"
        onClick={() => sort.onSort(field)}
        className={`inline-flex min-h-7 items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition hover:text-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {label}
        {active ? (
          sort.order === 'asc' ? <MdArrowUpward size={13} /> : <MdArrowDownward size={13} />
        ) : (
          <MdUnfoldMore size={13} className="text-slate-400" />
        )}
      </button>
    </th>
  );
}

export default function CompactOrdersTable({
  orders,
  statuses,
  itemStatuses,
  isLoading,
  page,
  totalPages,
  total,
  onPage,
  sort,
  columns = [],
  bulkActions = [],
  selectionLabel = 'orders',
  exportFileName = 'orders-selection.csv'
}) {
  const rowKey = (order) => order.orderNo;
  const { selectedRows, selectedOnPage, allPageSelected, offPageCount, isSelected, toggleRow, togglePage, clearSelection } =
    useBulkSelection({ data: orders, rowKey });

  return (
    <div className="card-ui overflow-hidden">
      <BulkActionBar
        selectedRows={selectedRows}
        offPageCount={offPageCount}
        clearSelection={clearSelection}
        bulkActions={bulkActions}
        columns={columns}
        selectionLabel={selectionLabel}
        exportFileName={exportFileName}
      />

      {isLoading ? (
        <TableSkeleton rows={10} cols={10} />
      ) : !orders.length ? (
        <EmptyState title="No orders found" icon={MdInbox} />
      ) : (
        // overflow-x-auto is a safety net, not the layout: nothing inside
        // declares a minimum width any more, so on a normal screen it never
        // engages.
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-900 text-white shadow-sm">
              <tr>
                <th scope="col" className="w-9 px-2 py-2 text-center">
                  <SelectionCheckbox
                    checked={allPageSelected}
                    indeterminate={selectedOnPage > 0 && !allPageSelected}
                    onChange={togglePage}
                    label={allPageSelected ? 'Deselect all orders on this page' : 'Select all orders on this page'}
                  />
                </th>
                <CompactHeader label="Order" field="orderNo" sort={sort} className="w-[12%]" />
                <CompactHeader label="Customer" className="w-[16%]" />
                <CompactHeader label="Fulfillment" field="status" sort={sort} className="w-[10%]" />
                <CompactHeader label="Item" className="w-[20%]" />
                <CompactHeader label="Qty / price" align="right" className="w-[9%]" />
                <CompactHeader label="Item state" className="w-[10%]" />
                <CompactHeader label="Money" field="total" sort={sort} align="right" className="w-[12%]" />
                <CompactHeader label="Tags & notes" className="w-[11%]" />
                <CompactHeader label="" className="w-9" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order, orderIndex) => {
                const items = Array.isArray(order.items) && order.items.length ? order.items : [null];
                const rowSpan = items.length;
                const key = String(rowKey(order));
                const selected = isSelected(key);
                const groupColor = selected
                  ? 'bg-[var(--brand-soft)]'
                  : orderIndex % 2 === 0
                    ? 'bg-white'
                    : 'bg-slate-50/70';

                return items.map((item, itemIndex) => (
                  <tr
                    key={`${order.id || order._id || order.orderNo}-${item?.id || item?._id || itemIndex}`}
                    aria-selected={selected}
                    className={`${groupColor} ${itemIndex === 0 ? 'border-t border-slate-300' : 'border-t border-slate-200/70'} align-top transition-colors hover:brightness-[0.985]`}
                  >
                    {itemIndex === 0 ? (
                      <>
                        <td rowSpan={rowSpan} className="border-l-4 border-l-[var(--brand)] px-2 py-2 text-center">
                          <SelectionCheckbox
                            checked={selected}
                            onChange={() => toggleRow(key, order)}
                            label={`${selected ? 'Deselect' : 'Select'} order ${order.orderNo}`}
                          />
                        </td>
                        <td rowSpan={rowSpan} className="px-2 py-2"><OrderCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2 py-2"><CustomerCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2 py-2"><FulfillmentCell order={order} statuses={statuses} /></td>
                      </>
                    ) : null}

                    <td className="px-2 py-2">
                      {item ? <ItemCell item={item} /> : <span className="text-slate-400">No items</span>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {item ? (
                        <div>
                          <p className="whitespace-nowrap font-bold text-slate-900">
                            {valueOrDash(item.quantity)} × {money(item.price)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {money((Number(item.quantity) || 1) * (Number(item.price) || 0))}
                          </p>
                          {item.returnedQty > 0 ? (
                            <p className="mt-0.5 text-[9px] font-semibold text-rose-700">{item.returnedQty} returned</p>
                          ) : null}
                          {item.customizePrice > 0 ? (
                            <p className="mt-0.5 text-[9px] text-amber-800">Custom {money(item.customizePrice)}</p>
                          ) : null}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-2 py-2">{item ? <ItemStateCell item={item} itemStatuses={itemStatuses} /> : '—'}</td>

                    {itemIndex === 0 ? (
                      <>
                        <td rowSpan={rowSpan} className="px-2 py-2"><MoneyCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2 py-2"><ContextCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2 py-2 text-right">
                          <Link
                            href={`/orders/${order.orderNo}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white/80 text-slate-600 transition hover:border-slate-400 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                            title={`Open order ${order.orderNo}`}
                            aria-label={`Open order ${order.orderNo}`}
                          >
                            <MdChevronRight size={16} />
                          </Link>
                        </td>
                      </>
                    ) : null}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPage={onPage} total={total} unit="orders" />
    </div>
  );
}
