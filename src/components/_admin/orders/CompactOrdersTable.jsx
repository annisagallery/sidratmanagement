'use client';

import Link from 'next/link';
import { MdArrowDownward, MdArrowUpward, MdChevronRight, MdInbox, MdUnfoldMore } from 'react-icons/md';

import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState, TableSkeleton } from 'src/components/_admin/ui/TableStates';
import { StatusBadge } from 'src/components/_admin/shared/StatusBadge';
import { fDate, fDateTime } from 'src/utils/formatTime';

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
  if (!tags.length) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex max-w-[180px] flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id || tag.slug || tag.name}
          className="rounded border px-1.5 py-0.5 text-[10px] font-semibold"
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

function OrderCell({ order }) {
  return (
    <div className="min-w-[138px]">
      <Link
        href={`/orders/${order.orderNo}`}
        className="font-mono text-[12px] font-extrabold text-slate-900 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
      >
        #{order.orderNo}
      </Link>
      <p className="mt-1 whitespace-nowrap text-[10px] text-slate-500">{dateTime(order.createdAt)}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <span className="rounded border border-slate-300 bg-white/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
          {sourceLabel(order)}
        </span>
        <span className="rounded border border-slate-300 bg-white/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
          {order.deliveryType || 'regular'}
        </span>
      </div>
    </div>
  );
}

function CustomerCell({ order }) {
  const address = order.shippingAddress || {};
  const phone = address.phone || order.user?.phone;
  const location = [address.address, address.upazila, address.district].filter(Boolean).join(', ');
  return (
    <div className="min-w-[190px] max-w-[240px]">
      <p className="font-semibold text-slate-900">{address.name || order.user?.name || 'Guest customer'}</p>
      {phone ? (
        <Link href={`/users/${encodeURIComponent(phone)}`} className="mt-0.5 block text-[11px] font-medium text-slate-600 hover:underline">
          {phone}
        </Link>
      ) : (
        <p className="mt-0.5 text-[11px] text-slate-400">No phone</p>
      )}
      {order.user?.email ? <p className="mt-0.5 break-all text-[10px] text-slate-500">{order.user.email}</p> : null}
      <p className="mt-1 text-[10px] leading-4 text-slate-500">{location || 'No delivery address'}</p>
    </div>
  );
}

function OwnerCell({ order }) {
  return (
    <div className="min-w-[135px]">
      <p className="font-semibold text-slate-800">
        {order.createdBy?.name || (order.source === 'online' ? 'Customer' : 'Unknown')}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {order.branch?.name || (order.source === 'admin' ? 'Contact center' : 'Online store')}
      </p>
      {order.createdBy?.role ? <p className="mt-0.5 text-[10px] capitalize text-slate-400">{order.createdBy.role}</p> : null}
    </div>
  );
}

function FulfillmentCell({ order, statuses }) {
  return (
    <div className="min-w-[135px]">
      <StatusBadge status={order.status} statuses={statuses} />
      <p className="mt-1.5 text-[10px] font-semibold text-slate-500">Due {date(order.estimatedDelivery)}</p>
    </div>
  );
}

function ItemCell({ item, index }) {
  const attributes = (item.attributes || []).filter((attribute) => attribute.valueName);
  return (
    <div className="min-w-[250px] max-w-[330px]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-900 px-1 text-[9px] font-bold text-white">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-4 text-slate-900">{itemName(item)}</p>
          {attributes.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {attributes.map((attribute, attributeIndex) => (
                <span
                  key={`${attribute.attributeName || 'attribute'}-${attribute.valueName}-${attributeIndex}`}
                  className="rounded border border-slate-300 bg-white/70 px-1 py-0.5 text-[9px] font-medium text-slate-600"
                >
                  {attribute.attributeName ? `${attribute.attributeName}: ` : ''}
                  {attribute.valueName}
                </span>
              ))}
            </div>
          ) : null}
          {item.customizeDetails ? (
            <p className="mt-1 text-[10px] leading-4 text-amber-800">Custom: {item.customizeDetails}</p>
          ) : item.isCustom ? (
            <p className="mt-1 text-[10px] font-semibold text-amber-800">Custom item</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ItemStateCell({ item, itemStatuses }) {
  const code = itemCode(item);
  return (
    <div className="min-w-[128px]">
      <StatusBadge status={item.status} statuses={itemStatuses} />
      {code ? <p className="mt-1.5 font-mono text-[10px] font-semibold text-slate-600">{code}</p> : null}
      {item.deliveryDate ? <p className="mt-1 text-[10px] text-slate-500">Item due {date(item.deliveryDate)}</p> : null}
    </div>
  );
}

function PaymentCell({ order }) {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  return (
    <div className="min-w-[142px]">
      <p className="font-semibold capitalize text-slate-800">{order.paymentStatus || 'Not set'}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase text-slate-500">{order.paymentMethod || 'No method'}</p>
      {payments.length ? (
        <div className="mt-1.5 space-y-1 border-t border-slate-300/70 pt-1.5">
          {payments.map((payment, index) => (
            <div key={payment.id || payment._id || index} className="text-[10px] leading-4 text-slate-600">
              <span className="font-semibold capitalize">{payment.method}</span> {money(payment.amount)}
              <span className="ml-1 capitalize text-slate-400">{payment.status}</span>
              {payment.trxId ? <p className="font-mono text-[9px] text-slate-500">{payment.trxId}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TotalsCell({ order }) {
  const totalDiscount = (Number(order.discount) || 0) + (Number(order.cashDiscount) || 0);
  return (
    <dl className="min-w-[155px] space-y-0.5 text-[10px] tabular-nums">
      <div className="flex justify-between gap-3"><dt className="text-slate-500">Subtotal</dt><dd>{money(order.subTotal)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-slate-500">Discount</dt><dd>-{money(totalDiscount)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-slate-500">Shipping</dt><dd>{money(order.shipping)}</dd></div>
      {(Number(order.vat) || 0) > 0 ? (
        <div className="flex justify-between gap-3"><dt className="text-slate-500">VAT {order.vatPercent ? `(${order.vatPercent}%)` : ''}</dt><dd>{money(order.vat)}</dd></div>
      ) : null}
      <div className="mt-1 flex justify-between gap-3 border-t border-slate-400/40 pt-1 text-[12px] font-extrabold text-slate-900">
        <dt>Total</dt><dd>{money(order.total)}</dd>
      </div>
      {order.couponCode ? <div className="pt-1 text-[9px] font-semibold text-slate-500">Coupon: {order.couponCode}</div> : null}
    </dl>
  );
}

function ContextCell({ order }) {
  return (
    <div className="min-w-[170px] max-w-[230px]">
      <Tags tags={order.tags} />
      <p className="mt-1.5 text-[10px] leading-4 text-slate-600">{order.note || 'No order note'}</p>
    </div>
  );
}

function CompactHeader({ label, field, sort, align = 'left' }) {
  const active = field && sort?.by === field;
  const alignment = align === 'right' ? 'text-right' : 'text-left';

  if (!field) {
    return (
      <th scope="col" className={`whitespace-nowrap px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider ${alignment}`}>
        {label}
      </th>
    );
  }

  return (
    <th scope="col" className={`whitespace-nowrap px-2.5 py-2 ${alignment}`}>
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
  sort
}) {
  return (
    <div className="card-ui overflow-hidden">
      {isLoading ? (
        <TableSkeleton rows={10} cols={9} />
      ) : !orders.length ? (
        <EmptyState title="No orders found" icon={MdInbox} />
      ) : (
        <div
          className="max-h-[70vh] overflow-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--brand-ring)]"
          tabIndex={0}
          aria-label="Compact order details table"
        >
          <table className="min-w-[1740px] border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10 border-b border-slate-300 bg-slate-900 text-white shadow-sm">
              <tr>
                <CompactHeader label="Order" field="orderNo" sort={sort} />
                <CompactHeader label="Customer & delivery" />
                <CompactHeader label="Created by" />
                <CompactHeader label="Fulfillment" field="status" sort={sort} />
                <CompactHeader label="Order item" />
                <CompactHeader label="Qty / price" align="right" />
                <CompactHeader label="Item state" />
                <CompactHeader label="Payment" />
                <CompactHeader label="Order totals" field="total" sort={sort} align="right" />
                <CompactHeader label="Tags & notes" />
                <CompactHeader label="" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order, orderIndex) => {
                const items = Array.isArray(order.items) && order.items.length ? order.items : [null];
                const rowSpan = items.length;
                const groupColor = orderIndex % 2 === 0 ? 'bg-white' : 'bg-[var(--brand-soft)]';

                return items.map((item, itemIndex) => (
                  <tr
                    key={`${order.id || order._id || order.orderNo}-${item?.id || item?._id || itemIndex}`}
                    className={`${groupColor} ${itemIndex === 0 ? 'border-t border-slate-300' : 'border-t border-slate-200/70'} align-top transition-colors hover:brightness-[0.985]`}
                  >
                    {itemIndex === 0 ? (
                      <>
                        <td rowSpan={rowSpan} className="border-l-4 border-l-[var(--brand)] px-2.5 py-2.5"><OrderCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2.5 py-2.5"><CustomerCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2.5 py-2.5"><OwnerCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2.5 py-2.5"><FulfillmentCell order={order} statuses={statuses} /></td>
                      </>
                    ) : null}

                    <td className="px-2.5 py-2.5">
                      {item ? <ItemCell item={item} index={itemIndex} /> : <span className="text-slate-400">No items</span>}
                    </td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums">
                      {item ? (
                        <div className="min-w-[92px]">
                          <p className="font-bold text-slate-900">{valueOrDash(item.quantity)} × {money(item.price)}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{money((Number(item.quantity) || 1) * (Number(item.price) || 0))}</p>
                          {item.returnedQty > 0 ? <p className="mt-1 text-[9px] font-semibold text-rose-700">{item.returnedQty} returned</p> : null}
                          {item.customizePrice > 0 ? <p className="mt-1 text-[9px] text-amber-800">Custom {money(item.customizePrice)}</p> : null}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-2.5 py-2.5">{item ? <ItemStateCell item={item} itemStatuses={itemStatuses} /> : '—'}</td>

                    {itemIndex === 0 ? (
                      <>
                        <td rowSpan={rowSpan} className="px-2.5 py-2.5"><PaymentCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2.5 py-2.5"><TotalsCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2.5 py-2.5"><ContextCell order={order} /></td>
                        <td rowSpan={rowSpan} className="px-2.5 py-2.5 text-right">
                          <Link
                            href={`/orders/${order.orderNo}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white/80 text-slate-600 transition hover:border-slate-400 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                            title={`Open order ${order.orderNo}`}
                            aria-label={`Open order ${order.orderNo}`}
                          >
                            <MdChevronRight size={18} />
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
