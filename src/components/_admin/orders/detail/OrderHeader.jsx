'use client';

/**
 * Identity and progress.
 *
 * The title row carries the three badges an order is judged by — fulfilment,
 * payment, courier — and the tracker below shows how far along the flow it is,
 * so "where is this order" is answered before anything is read.
 */

import { format } from 'date-fns';
import { FiCheck, FiChevronLeft, FiChevronRight, FiClock, FiPrinter, FiTruck, FiX } from 'react-icons/fi';

import { StatusBadge } from 'src/components/_admin/shared/StatusBadge';
import { CopyButton, PROVIDER_LABEL, PaymentBadge, money } from './parts';
import { ShipmentStatusPill } from './ShipmentsCard';
import { channelLabel } from './SidePanels';

// The fulfilment flow, as orderWorkflow.js walks it. Statuses that share a
// milestone (pending / awaiting payment, confirmed / processing) share a step.
const STEPS = [
  { label: 'Placed', match: ['awaiting_payment', 'pending'] },
  { label: 'Confirmed', match: ['confirmed', 'processing', 'production-needed'] },
  { label: 'Ready to pack', match: ['ready-to-pack'] },
  { label: 'Packed', match: ['packed'] },
  { label: 'Shipped', match: ['shipped'] },
  { label: 'Delivered', match: ['delivered', 'completed'] }
];

const stepIndex = (status) => STEPS.findIndex((step) => step.match.includes(status));

function Tracker({ order, packing, activeShipment }) {
  const cancelled = ['cancelled', 'canceled'].includes(order.status);
  const returned = ['returned', 'return'].includes(order.status);
  // A returned parcel got as far as shipping; a cancelled order stops wherever
  // it was, which the order row does not record, so it is drawn on its own.
  const current = returned ? stepIndex('shipped') : stepIndex(order.status);
  const steps = returned ? [...STEPS.slice(0, 5), { label: 'Returned' }] : STEPS;

  if (cancelled) {
    return (
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <FiX size={14} />
        </span>
        <div>
          <p className="text-sm font-semibold text-rose-700">Order cancelled</p>
          {order.updatedAt ? (
            <p className="text-xs text-slate-500">{format(new Date(order.updatedAt), 'dd MMM yyyy, hh:mm a')}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const detail = (index) => {
    if (index === 0 && order.createdAt) return format(new Date(order.createdAt), 'dd MMM, hh:mm a');
    if (index === 3 && packing?.total && current < 3) return `${packing.verified || 0}/${packing.total} scanned`;
    if (index === 4 && activeShipment) return PROVIDER_LABEL[activeShipment.provider] || activeShipment.provider;
    return null;
  };

  return (
    <ol className="flex min-w-[640px] items-start px-5 py-4">
      {steps.map((step, index) => {
        const done = index < current || (index === current && (returned || index === steps.length - 1));
        const active = index === current && !done;
        const failed = returned && index === steps.length - 1;
        const reached = index <= current || failed;
        const note = detail(index);

        return (
          <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span
                className={`absolute top-3.5 h-0.5 -translate-y-1/2 rounded-full ${
                  failed ? 'bg-rose-200' : reached ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
                style={{ left: 'calc(-50% + 20px)', right: 'calc(50% + 20px)' }}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                failed
                  ? 'bg-rose-100 text-rose-600 ring-4 ring-rose-50'
                  : done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-[var(--brand)] text-white ring-4 ring-[var(--brand-soft)]'
                      : 'border-2 border-slate-200 bg-white text-slate-500'
              }`}
            >
              {failed ? <FiX size={13} /> : done ? <FiCheck size={13} /> : index + 1}
            </span>
            <span
              className={`mt-2 text-xs font-semibold ${
                failed ? 'text-rose-600' : active ? 'text-slate-900' : reached ? 'text-slate-700' : 'text-slate-500'
              }`}
            >
              {step.label}
            </span>
            {note ? <span className="mt-0.5 text-[11px] text-slate-500">{note}</span> : null}
          </li>
        );
      })}
    </ol>
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
  const itemCount = (order.items || []).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to orders"
            title="Back to orders"
            className="btn-icon mt-0.5 shrink-0"
          >
            <FiChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                <span className="ops-code">#{order.orderNo}</span>
              </h1>
              <CopyButton value={order.orderNo} label="Copy order number" />
              <StatusBadge status={order.status} statuses={orderStatuses} />
              <PaymentBadge paid={paid} due={due} />
              {activeShipment ? <ShipmentStatusPill status={activeShipment.status} /> : null}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-slate-500">
              <span>{order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a') : '—'}</span>
              <span className="text-slate-300">•</span>
              <span>{channelLabel(order)}</span>
              {order.createdBy?.name ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span>by {order.createdBy.name}</span>
                </>
              ) : null}
              <span className="text-slate-300">•</span>
              <span>
                {itemCount} item{itemCount === 1 ? '' : 's'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-800">{money(order.total)}</span>
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
          <span className="ml-1 inline-flex overflow-hidden rounded-md border border-slate-200">
            <button
              type="button"
              onClick={onPrev}
              disabled={!order.previousOrder}
              title="Previous order (←)"
              aria-label="Previous order"
              className="flex h-9 w-9 items-center justify-center bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <FiChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!order.nextOrder}
              title="Next order (→)"
              aria-label="Next order"
              className="flex h-9 w-9 items-center justify-center border-l border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <FiChevronRight size={16} />
            </button>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/50">
        <Tracker order={order} packing={packing} activeShipment={activeShipment} />
      </div>
    </div>
  );
}
