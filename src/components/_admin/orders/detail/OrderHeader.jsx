'use client';

/**
 * Identity and progress.
 *
 * One quiet row says which order this is and how it stands (fulfilment,
 * payment, courier); the menus on the right hold everything that is not the
 * next step. A slim tracker underneath shows how far along the flow it is.
 */

import { format } from 'date-fns';
import { FiCheck, FiChevronLeft, FiChevronRight, FiMoreHorizontal, FiPrinter, FiX } from 'react-icons/fi';

import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { StatusBadge } from 'src/components/_admin/shared/StatusBadge';
import { CopyButton, PaymentBadge, money } from './parts';
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

function Tracker({ order }) {
  const cancelled = ['cancelled', 'canceled'].includes(order.status);
  const returned = ['returned', 'return'].includes(order.status);
  if (cancelled) return null;

  // A returned parcel got as far as shipping.
  const current = returned ? stepIndex('shipped') : stepIndex(order.status);
  const steps = returned ? [...STEPS.slice(0, 5), { label: 'Returned' }] : STEPS;
  const last = steps.length - 1;

  return (
    <ol className="flex min-w-[560px] items-center gap-2 px-5 py-3" aria-label="Order progress">
      {steps.map((step, index) => {
        const done = index < current || (index === current && (returned || index === last));
        const active = index === current && !done;
        const failed = returned && index === last;
        return (
          <li key={step.label} className="flex flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                failed
                  ? 'bg-rose-600 text-white'
                  : done
                    ? 'bg-slate-900 text-white'
                    : active
                      ? 'border-2 border-slate-900 bg-white'
                      : 'border-2 border-slate-200 bg-white'
              }`}
              aria-hidden
            >
              {failed ? <FiX size={11} /> : done ? <FiCheck size={11} /> : null}
            </span>
            <span
              className={`whitespace-nowrap text-xs ${
                failed ? 'font-semibold text-rose-700' : active ? 'font-semibold text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              {step.label}
              {done && !failed ? <span className="sr-only"> (done)</span> : null}
            </span>
            {index < last ? <span className={`h-px flex-1 ${index < current ? 'bg-slate-900' : 'bg-slate-200'}`} aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderHeader({ order, orderStatuses, activeShipment, paid, due, onPrev, onNext, printItems, moreItems }) {
  const itemCount = (order.items || []).length;

  return (
    <header className="card-ui">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="ops-code text-xl font-semibold tracking-tight text-slate-900">#{order.orderNo}</h1>
              <CopyButton value={order.orderNo} label="Copy order number" />
              <StatusBadge status={order.status} statuses={orderStatuses} />
              <PaymentBadge paid={paid} due={due} />
              {activeShipment ? <ShipmentStatusPill status={activeShipment.status} /> : null}
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {order.createdAt ? format(new Date(order.createdAt), 'd MMM yyyy, h:mm a') : '—'}
              {' · '}
              {channelLabel(order)}
              {order.createdBy?.name ? ` · by ${order.createdBy.name}` : ''}
              {' · '}
              {itemCount} item{itemCount === 1 ? '' : 's'}
              {' · '}
              <span className="font-semibold tabular-nums text-slate-900">{money(order.total)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActionMenu label="Print" items={printItems} icon={FiPrinter} text="Print" />
          <ActionMenu label="More order actions" items={moreItems} icon={FiMoreHorizontal} text="More" />
          <span className="inline-flex overflow-hidden rounded-md border border-slate-200" role="group" aria-label="Browse orders">
            <button
              type="button"
              onClick={onPrev}
              disabled={!order.previousOrder}
              title="Previous order (←)"
              aria-label="Previous order"
              className="flex h-9 w-9 items-center justify-center bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <FiChevronLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!order.nextOrder}
              title="Next order (→)"
              aria-label="Next order"
              className="flex h-9 w-9 items-center justify-center border-l border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <FiChevronRight size={16} aria-hidden />
            </button>
          </span>
        </div>
      </div>

      <div className="admin-sidebar-scroll overflow-x-auto border-t border-slate-100">
        <Tracker order={order} />
      </div>
    </header>
  );
}
