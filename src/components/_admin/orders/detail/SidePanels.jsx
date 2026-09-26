'use client';

/**
 * The reference column: who, where, and under what terms.
 *
 * Nothing here acts on the order — it is what someone reads out on a phone call
 * or copies into a courier form, so phone numbers and addresses are one click
 * from the clipboard.
 */

import { format } from 'date-fns';
import { FiFileText, FiMail, FiMapPin, FiMessageCircle, FiPhone, FiUser } from 'react-icons/fi';

import { Card, CopyButton, Row, money, tagColor, tagId, tagName } from './parts';

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

function SubHeading({ children, actions }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</p>
      {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

function ContactLine({ icon: Icon, children, copy, copyLabel }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-slate-700">
      <Icon size={13} className="shrink-0 text-slate-500" />
      <span className="min-w-0 truncate">{children}</span>
      {copy ? <CopyButton value={copy} label={copyLabel} /> : null}
    </p>
  );
}

/* ── customer note ───────────────────────────────────────────────────────── */

export function NotePanel({ note }) {
  if (!note) return null;
  return (
    <Card title="Customer note" icon={FiMessageCircle}>
      <p className="whitespace-pre-wrap border-t border-amber-100 bg-amber-50/70 px-5 py-3 text-[13px] leading-relaxed text-amber-900">
        {note}
      </p>
    </Card>
  );
}

/* ── customer, contact and delivery address ──────────────────────────────── */

export function CustomerPanel({ order, onEditAddress }) {
  const customer = order.user || null;
  const address = order.shippingAddress || {};
  const name = customer?.name || order.guestName || address.name || 'Guest customer';
  const phone = customer?.phone || address.phone || '';
  const street = [address.address, address.area].filter(Boolean).join(', ');
  const region = [
    address.upazila || address.zone?.zone_name || (typeof address.zone === 'string' ? address.zone : null),
    address.district || address.city?.city_name || (typeof address.city === 'string' ? address.city : null)
  ]
    .filter(Boolean)
    .join(', ');
  const clipboard = [address.name, address.phone, street, region].filter(Boolean).join('\n');
  const hasAddress = Boolean(street || region || address.name);

  return (
    <Card title="Customer" icon={FiUser}>
      <div className="border-t border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand-strong)]">
            {name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            {phone ? (
              <a
                href={`/users/${encodeURIComponent(phone)}`}
                className="block truncate text-sm font-semibold text-[var(--brand-strong)] hover:underline"
              >
                {name}
              </a>
            ) : (
              <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            )}
            <p className="text-xs text-slate-500">
              {customer ? 'Registered' : 'Guest'}
              {customer?.cash ? ` · ${money(customer.cash)} Sidrat Cash` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-slate-100 px-5 py-4">
        <SubHeading>Contact</SubHeading>
        {phone ? (
          <ContactLine icon={FiPhone} copy={phone} copyLabel="Copy phone number">
            <a href={`tel:${phone}`} className="hover:underline">
              {phone}
            </a>
          </ContactLine>
        ) : null}
        {customer?.email ? (
          <ContactLine icon={FiMail} copy={customer.email} copyLabel="Copy email">
            {customer.email}
          </ContactLine>
        ) : null}
        {!phone && !customer?.email ? <p className="text-[13px] text-slate-500">No contact details</p> : null}
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <SubHeading
          actions={
            <>
              {hasAddress ? <CopyButton value={clipboard} label="Copy the whole address" /> : null}
              <button
                type="button"
                onClick={onEditAddress}
                className="text-xs font-semibold text-[var(--brand-strong)] hover:underline"
              >
                Edit
              </button>
            </>
          }
        >
          Shipping address
        </SubHeading>
        {hasAddress ? (
          <address className="space-y-0.5 text-[13px] not-italic leading-relaxed text-slate-700">
            {address.name ? <p className="font-medium text-slate-900">{address.name}</p> : null}
            {address.phone && address.phone !== phone ? <p>{address.phone}</p> : null}
            {street ? <p>{street}</p> : <p className="text-amber-600">Street not given</p>}
            {region ? (
              <p className="flex items-start gap-1.5">
                <FiMapPin size={12} className="mt-1 shrink-0 text-slate-400" />
                {region}
              </p>
            ) : null}
          </address>
        ) : (
          <p className="text-[13px] text-slate-500">No delivery address</p>
        )}
      </div>
    </Card>
  );
}

/* ── terms & provenance ──────────────────────────────────────────────────── */

export function MetaPanel({ order }) {
  const tags = order.tags || [];

  return (
    <Card title="Order details" icon={FiFileText}>
      <dl className="border-t border-slate-100 px-5 py-2">
        <Row label="Payment method" value={<span className="uppercase">{order.paymentMethod || 'COD'}</span>} />
        <Row label="Delivery" value={DELIVERY_LABEL[order.deliveryType] || order.deliveryType} />
        <Row
          label="Promised by"
          value={order.estimatedDelivery ? format(new Date(order.estimatedDelivery), 'dd MMM yyyy') : null}
          keepEmpty
        />
        <Row label="Coupon" value={order.couponCode || (typeof order.coupon === 'string' ? order.coupon : null)} mono />
        <Row label="Branch" value={order.branch?.name} />
        <Row
          label="Last updated"
          value={order.updatedAt ? format(new Date(order.updatedAt), 'dd MMM yyyy, hh:mm a') : null}
        />
      </dl>
      {tags.length ? (
        <div className="border-t border-slate-100 px-5 py-3">
          <SubHeading>Tags</SubHeading>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tagId(tag)}
                className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                style={
                  tagColor(tag)
                    ? { borderColor: `${tagColor(tag)}55`, color: tagColor(tag), backgroundColor: `${tagColor(tag)}1a` }
                    : { borderColor: '#e2e8f0', color: '#475569', backgroundColor: '#f8fafc' }
                }
              >
                {tagName(tag)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
