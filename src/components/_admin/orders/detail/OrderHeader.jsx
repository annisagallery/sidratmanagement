'use client';

/**
 * Identity and vital signs.
 *
 * The five tiles are the questions asked about an order in the first two
 * seconds — where is it, is it paid, is it packed, is it moving, what is it
 * worth — and they are always in the same five places so they can be read
 * without being searched for.
 */

import { format } from 'date-fns';
import { FiChevronLeft, FiChevronRight, FiClock, FiPrinter, FiTruck } from 'react-icons/fi';

import { StatusBadge } from 'src/components/_admin/shared/StatusBadge';
import { CopyButton, Pill, money } from './parts';
import { ShipmentStatusPill } from './ShipmentsCard';
import { channelLabel } from './SidePanels';

function Tile({ label, children, note }) {
  return (
    <div className="border-t border-slate-100 px-4 py-3 sm:border-l sm:border-t-0 sm:first:border-l-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-1.5">{children}</div>
      {note ? <p className="mt-1 text-[11px] text-slate-400">{note}</p> : null}
    </div>
  );
}

export default function OrderHeader({
  order,
  orderStatuses,
  activeShipment,
  paid,
  due,
  packing,
  onBack,
  onPrev,
  onNext,
  onPrint,
  onPrintLabel,
  onHistory
}) {
  const packedCount = packing?.verified || 0;
  const packedTotal = packing?.total || 0;

  return (
    <div className="card-ui overflow-hidden">
      <div className="h-1" style={{ backgroundColor: 'var(--brand)' }} />

      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to orders"
            className="btn-icon shrink-0"
            title="Back to orders"
          >
            <FiChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                Order <span className="ops-code">#{order.orderNo}</span>
              </h1>
              <CopyButton value={order.orderNo} label="Copy order number" />
              <Pill tone="neutral">{channelLabel(order)}</Pill>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Placed {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a') : '—'}
              {order.createdBy?.name ? ` · by ${order.createdBy.name}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onPrint} className="btn-ghost h-9 !text-xs">
            <FiPrinter size={14} /> Invoice
          </button>
          {onPrintLabel && (
            <button type="button" onClick={onPrintLabel} className="btn-ghost h-9 !text-xs">
              <FiTruck size={14} /> Label
            </button>
          )}
          <button type="button" onClick={onHistory} className="btn-ghost h-9 !text-xs">
            <FiClock size={14} /> History
          </button>
          <span className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={onPrev}
              disabled={!order.previousOrder}
              title="Previous order (←)"
              aria-label="Previous order"
              className="btn-icon"
            >
              <FiChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!order.nextOrder}
              title="Next order (→)"
              aria-label="Next order"
              className="btn-icon"
            >
              <FiChevronRight size={16} />
            </button>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 border-t border-slate-200 bg-slate-50/70 sm:grid-cols-3 xl:grid-cols-5">
        <Tile label="Fulfilment">
          <StatusBadge status={order.status} statuses={orderStatuses} />
        </Tile>

        <Tile label="Payment" note={due > 0 ? `${money(due)} still due` : 'Nothing outstanding'}>
          <Pill tone={order.paymentStatus === 'paid' ? 'good' : due > 0 ? 'warn' : 'neutral'}>
            {order.paymentStatus || 'unpaid'}
          </Pill>
          <span className="ml-2 text-xs font-semibold text-slate-500">{money(paid)} received</span>
        </Tile>

        <Tile
          label="Packing"
          note={packedTotal ? `${packedCount} of ${packedTotal} pieces scanned` : 'No pieces to scan'}
        >
          {packedTotal ? (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                <span
                  className="block h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((packedCount / packedTotal) * 100)}%` }}
                />
              </span>
              <span className="ops-code text-[13px] font-bold text-slate-700">
                {packedCount}/{packedTotal}
              </span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-slate-400">—</span>
          )}
        </Tile>

        <Tile
          label="Courier"
          note={activeShipment?.consignmentId ? `CN ${activeShipment.consignmentId}` : 'No consignment yet'}
        >
          {activeShipment ? (
            <ShipmentStatusPill status={activeShipment.status} />
          ) : (
            <span className="text-sm font-semibold text-slate-400">Not dispatched</span>
          )}
        </Tile>

        <Tile label="Order total" note={`${(order.items || []).length} item${(order.items || []).length === 1 ? '' : 's'}`}>
          <span className="text-lg font-black tabular-nums text-slate-900">{money(order.total)}</span>
        </Tile>
      </div>
    </div>
  );
}
