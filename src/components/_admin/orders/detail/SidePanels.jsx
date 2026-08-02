'use client';

/**
 * The reference column: who, where, how much, and under what terms.
 *
 * Nothing here acts on the order — it is what someone reads out on a phone call
 * or copies into a courier form, so phone numbers and addresses are one click
 * from the clipboard and the money breakdown never hides a line.
 */

import { format } from 'date-fns';
import { FiDollarSign, FiFileText, FiMapPin, FiPhone, FiUser } from 'react-icons/fi';

import { CopyButton, MoneyRow, Pill, Row, Section, SectionBody, money, tagColor, tagId, tagName } from './parts';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Where the order came from. Older manual showroom orders were stored as POS,
 * so a due date materially later than checkout is what separates them from an
 * instant counter sale.
 */
export function channelLabel(order) {
  if (order.source === 'showroom') return 'Showroom';
  const dueGap =
    order.estimatedDelivery && order.createdAt
      ? new Date(order.estimatedDelivery).getTime() - new Date(order.createdAt).getTime()
      : 0;
  if (order.source === 'pos' && dueGap > HOUR_MS) return 'Showroom';
  return { online: 'Online store', admin: 'Contact centre', pos: 'POS counter' }[order.source] || 'Online store';
}

const DELIVERY_LABEL = { regular: 'Regular', urgent: 'Urgent', sameDay: 'Same day' };

const fullAddress = (address = {}) =>
  [address.address, address.area, address.upazila, address.district].filter(Boolean).join(', ');

/* ── customer ────────────────────────────────────────────────────────────── */

export function CustomerPanel({ order }) {
  const customer = order.user || null;
  const name = customer?.name || order.guestName || order.shippingAddress?.name || 'Guest customer';
  const phone = customer?.phone || order.shippingAddress?.phone || '';

  return (
    <Section title="Customer" icon={FiUser}>
      <SectionBody>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{name}</p>
            <p className="mt-0.5 text-xs text-slate-400">{customer ? 'Registered account' : 'Guest checkout'}</p>
          </div>
          <Pill tone="neutral">{channelLabel(order)}</Pill>
        </div>

        <dl className="mt-3">
          <Row
            label="Phone"
            value={
              phone ? (
                <span className="inline-flex items-center gap-1">
                  <a href={`tel:${phone}`} className="hover:underline">
                    {phone}
                  </a>
                  <CopyButton value={phone} label="Copy phone number" />
                </span>
              ) : null
            }
          />
          <Row label="Email" value={customer?.email} />
          <Row label="Wallet balance" value={customer?.cash ? money(customer.cash) : null} />
        </dl>

        {phone ? (
          <a
            href={`/users/${encodeURIComponent(phone)}`}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-strong)] hover:underline"
          >
            <FiPhone size={12} /> View customer history
          </a>
        ) : null}
      </SectionBody>
    </Section>
  );
}

/* ── delivery address ────────────────────────────────────────────────────── */

export function AddressPanel({ order, onEdit }) {
  const address = order.shippingAddress || {};
  const line = fullAddress(address);
  const clipboard = [address.name, address.phone, line].filter(Boolean).join('\n');

  return (
    <Section
      title="Delivery address"
      icon={FiMapPin}
      actions={
        <>
          <CopyButton value={clipboard} label="Copy the whole address" />
          <button type="button" onClick={onEdit} className="text-xs font-semibold text-[var(--brand-strong)] hover:underline">
            Edit
          </button>
        </>
      }
    >
      <SectionBody>
        {line || address.name ? (
          <dl>
            <Row label="Recipient" value={address.name} />
            <Row
              label="Phone"
              value={
                address.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <a href={`tel:${address.phone}`} className="hover:underline">
                      {address.phone}
                    </a>
                    <CopyButton value={address.phone} label="Copy phone number" />
                  </span>
                ) : null
              }
            />
            <Row label="District" value={address.district || address.city?.city_name || address.city} />
            <Row label="Upazila" value={address.upazila || address.zone?.zone_name || address.zone} />
            <Row label="Area" value={address.area} />
            <Row label="Street" value={address.address} keepEmpty />
          </dl>
        ) : (
          <p className="text-sm text-slate-400">
            No delivery address on this order. Add one before creating a consignment.
          </p>
        )}
      </SectionBody>
    </Section>
  );
}

/* ── bill ────────────────────────────────────────────────────────────────── */

export function BillPanel({ order, paid, due }) {
  return (
    <Section title="Bill" icon={FiDollarSign}>
      <SectionBody>
        <div className="space-y-1.5">
          <MoneyRow label="Items subtotal" amount={order.subTotal} />
          <MoneyRow label="Shipping" amount={order.shipping} />
          {order.discount > 0 ? <MoneyRow label="Discount" amount={order.discount} tone="credit" sign="−" /> : null}
          {order.cashDiscount > 0 ? (
            <MoneyRow label="Wallet / cash" amount={order.cashDiscount} tone="credit" sign="−" />
          ) : null}
          {order.vat > 0 ? <MoneyRow label="VAT" hint={`${order.vatPercent}%`} amount={order.vat} /> : null}
          <MoneyRow label="Order total" amount={order.total} strong />
          <div className="mt-2 space-y-1.5 border-t border-dashed border-slate-200 pt-2">
            <MoneyRow label="Paid" amount={paid} tone="paid" />
            <MoneyRow label={due > 0 ? 'Still due' : 'Nothing due'} amount={due} tone={due > 0 ? 'due' : 'muted'} />
          </div>
        </div>
      </SectionBody>
    </Section>
  );
}

/* ── terms & provenance ──────────────────────────────────────────────────── */

export function MetaPanel({ order }) {
  const tags = order.tags || [];

  return (
    <Section title="Order details" icon={FiFileText}>
      <SectionBody>
        <dl>
          <Row label="Payment method" value={<span className="uppercase">{order.paymentMethod || 'COD'}</span>} />
          <Row label="Delivery type" value={DELIVERY_LABEL[order.deliveryType] || order.deliveryType} />
          <Row
            label="Promised by"
            value={order.estimatedDelivery ? format(new Date(order.estimatedDelivery), 'dd MMM yyyy') : null}
            keepEmpty
          />
          <Row label="Coupon" value={order.couponCode || order.coupon} mono />
          <Row label="Channel" value={channelLabel(order)} />
          <Row label="Created by" value={order.createdBy?.name || (order.source === 'online' ? 'Customer' : null)} />
          <Row label="Branch" value={order.branch?.name} />
          <Row
            label="Placed"
            value={order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a') : null}
          />
          <Row
            label="Last updated"
            value={order.updatedAt ? format(new Date(order.updatedAt), 'dd MMM yyyy, hh:mm a') : null}
          />
          <Row
            label="Tags"
            value={
              tags.length ? (
                <span className="inline-flex flex-wrap justify-end gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tagId(tag)}
                      className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                      style={
                        tagColor(tag)
                          ? { borderColor: `${tagColor(tag)}55`, color: tagColor(tag), backgroundColor: `${tagColor(tag)}22` }
                          : { borderColor: '#e2e8f0', color: '#475569', backgroundColor: '#f8fafc' }
                      }
                    >
                      {tagName(tag)}
                    </span>
                  ))}
                </span>
              ) : null
            }
          />
        </dl>
      </SectionBody>
    </Section>
  );
}
