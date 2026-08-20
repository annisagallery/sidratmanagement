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

/**
 * SKUs carried over from the old MySQL POS are not SKUs.
 *
 * The importer stamps every variation it creates with
 * `MYSQL-<sourceProductId>-<optionId>`
 * (database-migrations/scripts/migrate-from-mysql/index.js),
 * and the rollback script finds migrated rows by exactly that prefix — so the
 * value has to stay in the database. It is bookkeeping, not a name, and showing
 * it puts "MYSQL-1406-7320" where "Classic Black / Cherry" belongs.
 */
const INTERNAL_SKU = /^MYSQL-/i;

/** A SKU worth showing someone, or null. */
export const displaySku = (sku) => {
  const value = String(sku || '').trim();
  return value && !INTERNAL_SKU.test(value) ? value : null;
};

/**
 * How a variation is named out loud: its attribute values, else its SKU.
 *
 * Attributes come first because "Classic Black / Cherry" is what someone on the
 * floor says; a SKU is a lookup key and is only a name when there is nothing
 * else to call the thing.
 */
export const variationLabel = (variation) => {
  const attributes = (variation?.attributes || [])
    .map((attribute) => attribute.valueName)
    .filter(Boolean)
    .join(' / ');
  return attributes || displaySku(variation?.sku) || 'Base product';
};

/**
 * The code printed on a sticker: product code, then the variation's production
 * code. It is the tail of every production unit barcode, and the whole of the
 * catalogue barcode for a variation that has none of its own — which is why the
 * floor calls it "the production code" and expects to see it next to the name.
 */
export const catalogCode = (product, variation) => {
  const productCode = Number(product?.code);
  if (!Number.isFinite(productCode) || productCode <= 0) return null;
  const optionCode = Number(variation?.productionCode);
  const left = String(productCode).padStart(4, '0');
  return Number.isFinite(optionCode) && optionCode > 0
    ? `${left}-${String(optionCode).padStart(4, '0')}`
    : left;
};

/**
 * The product name on a production queue row.
 *
 * These rows are OrderItems, and an OrderItem keeps a snapshot of the product
 * as it was when the customer ordered. The snapshot is the fallback rather than
 * the first choice: it is the only name left if the product is later deleted.
 */
export const needName = (item) =>
  item?.product?.name || item?.productSnapshotName || 'Unknown product';
