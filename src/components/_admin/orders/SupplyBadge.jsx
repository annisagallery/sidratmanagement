'use client';

/**
 * What is happening to this order line's physical piece.
 *
 * Whether the piece is queued, in a batch, or on the cutting table is a fact
 * about its ProductionUnit, read here by join rather than duplicated onto the
 * order row where the two could disagree. Renders as the same badge shape as
 * StatusBadge so it sits naturally in the existing table.
 */

import { StateChip, readState } from 'src/components/_admin/ops/primitives';

export default function SupplyBadge({ item, showDue = true }) {
  const { key, label } = readState(item);
  const due = showDue && item?.deliveryDate ? new Date(item.deliveryDate) : null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StateChip state={key} label={label} />
      {item?.packVerifiedAt ? <span className="text-xs font-medium text-emerald-700">scanned</span> : null}
      {due ? (
        <span className="text-xs text-slate-400">
          due {due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </span>
      ) : null}
    </span>
  );
}
