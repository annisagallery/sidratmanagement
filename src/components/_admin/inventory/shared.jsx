'use client';

/**
 * Vocabulary shared by the stock and transfer screens.
 *
 * The words here are the ones used on the warehouse floor: a piece is *on
 * hand*, *reserved* for a customer, or *available* to sell. Every screen names
 * them the same way and colours them the same way, so a number never has to be
 * re-interpreted when moving between screens.
 */

import { Pill } from 'src/components/_admin/ui/primitives';

export { oid, money, qty, normalizeList, errorText } from 'src/components/_admin/ui/primitives';

/** Available = what is left after the promises already made. */
export const availableOf = (onHand, reserved) => Math.max(0, Number(onHand || 0) - Number(reserved || 0));

/**
 * Stock health in one word. `low` is deliberately a fixed small number rather
 * than a per-product reorder point: this is the list view's traffic light, and
 * the product's own limits page is where the real threshold lives.
 */
export function stockState(available) {
  if (available <= 0) return { key: 'out', label: 'Out of stock', tone: 'bad' };
  if (available < 5) return { key: 'low', label: 'Low', tone: 'warn' };
  return { key: 'ok', label: 'In stock', tone: 'good' };
}

export function StockPill({ available }) {
  const state = stockState(available);
  return <Pill tone={state.tone}>{state.label}</Pill>;
}

/* ── transfers ───────────────────────────────────────────────────────────── */

/**
 * A transfer's life: drafted, approved, put on a van, received. Each status
 * carries the act that moves it on, so the list can offer exactly one button.
 */
export const TRANSFER_STATUS = {
  DRAFT: { label: 'Draft', tone: 'neutral', next: { action: 'approve', label: 'Approve' } },
  APPROVED: { label: 'Approved', tone: 'info', next: { action: 'dispatch', label: 'Dispatch' } },
  IN_TRANSIT: { label: 'In transit', tone: 'warn', next: { action: 'receive', label: 'Receive' } },
  RECEIVED: { label: 'Received', tone: 'good', next: null },
  CANCELLED: { label: 'Cancelled', tone: 'bad', next: null }
};

export function TransferStatusPill({ status }) {
  const meta = TRANSFER_STATUS[status] || { label: status, tone: 'neutral' };
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

/* ── production ──────────────────────────────────────────────────────────── */

export const BATCH_STATUS = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  IN_PRODUCTION: { label: 'In production', tone: 'warn' },
  COMPLETED: { label: 'Completed', tone: 'good' },
  CANCELLED: { label: 'Cancelled', tone: 'bad' }
};

export function BatchStatusPill({ status }) {
  const meta = BATCH_STATUS[status] || { label: status, tone: 'neutral' };
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

/** How a variation is named on paper: its SKU, else its attribute values. */
export const variationLabel = (variation) =>
  variation?.sku ||
  variation?.attributes
    ?.map((attribute) => attribute.valueName)
    .filter(Boolean)
    .join(' / ') ||
  'Base product';
