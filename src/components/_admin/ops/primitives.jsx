'use client';

/**
 * Shared bits for the production and fulfilment screens.
 *
 * These deliberately look like the rest of the admin: same badge shape as
 * StatusBadge, same `card-ui` surface, same control heights. The only thing
 * this module really owns is the *mapping* from a stored status to a colour
 * and a word, so a state reads identically on the queue, the scan desk, the
 * packing bench and the order page.
 */

// Matches the palette StatusBadge renders from, so nothing looks foreign.
const STATE_COLOR = {
  waiting: '#6b7280',
  making: '#d97706',
  ready: '#059669',
  gone: '#0284c7',
  stopped: '#e11d48'
};

/**
 * Fold any stored status — demand or supply, canonical or legacy — into one
 * state plus the words an operator would actually use for it.
 */
export function readState(item = {}) {
  const status = String(item.status || '');
  const unit = item.assignedUnit || null;

  if (['cancelled', 'canceled', 'VOID'].includes(status)) return { key: 'stopped', label: 'Cancelled' };
  if (['returned', 'return', 'RETURNED'].includes(status)) return { key: 'stopped', label: 'Returned' };
  if (status === 'delivered') return { key: 'gone', label: 'Delivered' };
  if (['shipped', 'SOLD'].includes(status)) return { key: 'gone', label: 'Shipped' };
  if (status === 'packed') return { key: 'ready', label: 'Packed' };
  if (['ready', 'reserved', 'RESERVED'].includes(status)) {
    // Provenance needs no stored column: a ready piece with a unit was made
    // here, one without came off the shelf. A unit still on the line is not
    // provenance for a ready row — it is a contradiction, and calling it "Made"
    // sent packers to scan a barcode the server had to reject.
    const made = unit && unit.status !== 'IN_PRODUCTION';
    return { key: 'ready', label: made ? 'Made' : 'From stock' };
  }
  if (status === 'AVAILABLE') return { key: 'ready', label: 'In stock' };
  if (status === 'in-production' || status === 'IN_PRODUCTION' || unit?.status === 'IN_PRODUCTION') {
    return { key: 'making', label: 'In production' };
  }
  if (['production-needed', 'awaiting-supply', 'processing'].includes(status)) {
    return { key: 'waiting', label: 'Needs piece' };
  }
  if (status === 'pending') return { key: 'waiting', label: 'Not confirmed' };
  return { key: 'waiting', label: status || '—' };
}

/** Same shape as StatusBadge, driven by state instead of the Status table. */
export function StateChip({ state = 'waiting', label }) {
  const color = STATE_COLOR[state] || STATE_COLOR.waiting;
  return (
    <span
      className="inline-block whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      {label}
    </span>
  );
}

/** A code a human matches against a physical label. */
export function Code({ children, className = '' }) {
  if (!children) return null;
  return <span className={`ops-code text-xs font-semibold ${className}`}>{children}</span>;
}

/** Empty states are an instruction, not a mood. */
export function Empty({ title, hint, Icon = null }) {
  return (
    <div className="px-6 py-10 text-center">
      {Icon ? <Icon className="mx-auto mb-2 text-2xl text-slate-300" /> : null}
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
