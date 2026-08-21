'use client';

/**
 * The words a purchase is described in.
 *
 * A purchase has two lives running at once — has the stock arrived, and has the
 * supplier been paid — and they move independently: goods often land before the
 * invoice is settled, and occasionally the other way round. Every screen shows
 * both, side by side, so nobody reads one and assumes the other.
 */

import { Pill } from 'src/components/_admin/ui/primitives';

export const PURCHASE_STATUS = {
  PENDING: { label: 'Pending', tone: 'neutral' },
  ORDERED: { label: 'Ordered', tone: 'info' },
  PARTIAL: { label: 'Part received', tone: 'warn' },
  RECEIVED: { label: 'Received', tone: 'good' },
  CANCELLED: { label: 'Cancelled', tone: 'bad' }
};

export const PAYMENT_STATUS = {
  UNPAID: { label: 'Unpaid', tone: 'bad' },
  PARTIAL: { label: 'Part paid', tone: 'warn' },
  PAID: { label: 'Paid', tone: 'good' }
};

export function PurchaseStatusPill({ status }) {
  const meta = PURCHASE_STATUS[status] || { label: status, tone: 'neutral' };
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function PaymentStatusPill({ status }) {
  const meta = PAYMENT_STATUS[status] || { label: status, tone: 'neutral' };
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

/** What is still owed on a purchase, never below zero. */
export const dueOf = (purchase) =>
  Math.max(0, Number(purchase?.grandTotal || 0) - Number(purchase?.paidAmount || 0));

/** How many units of a purchase are still to arrive. */
export const outstandingUnits = (purchase) =>
  (purchase?.items || []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.receivedQuantity || 0)),
    0
  );
