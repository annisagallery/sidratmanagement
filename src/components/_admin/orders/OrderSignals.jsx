'use client';

import { MdCheckCircleOutline, MdOutlineSchedule, MdWarningAmber } from 'react-icons/md';
import Badge from 'src/components/_admin/ui/Badge';

export function orderRowTone(order) {
  const { deadline, readiness } = order.signals || {};
  if (deadline?.state === 'overdue') return 'bg-rose-50/40';
  if (deadline?.state === 'due-today' || deadline?.state === 'due-soon') return 'bg-amber-50/40';
  if (readiness?.state === 'ready' || readiness?.state === 'packed') return 'bg-emerald-50/30';
  return '';
}

export function OrderReadiness({ order }) {
  const readiness = order.signals?.readiness;
  const total = readiness?.total ?? order.itemCount ?? 0;
  const ready = readiness?.ready ?? order.readyItemCount ?? 0;
  const allReady = total > 0 && ready >= total;
  return (
    <div className="mx-auto w-24 space-y-1.5">
      <p className={`text-xs font-semibold tabular-nums ${allReady ? 'text-emerald-800' : 'text-slate-700'}`}>
        {ready} / {total} ready
      </p>
      <div role="progressbar" aria-label={`Products ready for order ${order.orderNo}`} aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={ready}
        className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${allReady ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${total > 0 ? Math.min(100, ready / total * 100) : 0}%` }} />
      </div>
    </div>
  );
}

export default function OrderSignals({ order }) {
  const { deadline, readiness } = order.signals || {};
  if (!deadline) return null;
  const urgent = ['overdue', 'due-today', 'due-soon'].includes(deadline.state);
  const ready = ['ready', 'packed'].includes(readiness?.state);
  const Icon = deadline.state === 'overdue' ? MdWarningAmber : MdOutlineSchedule;
  return (
    <div className="mt-2 space-y-1.5">
      {urgent ? <div>
        <Badge tone={deadline.tone}><Icon className="shrink-0" size={14} aria-hidden />{deadline.label}</Badge>
        <p className="mt-1 text-xs text-slate-600">Due {deadline.dateLabel}</p>
      </div> : <p className="text-xs text-slate-500">{deadline.label}</p>}
      {ready && <Badge tone="success"><MdCheckCircleOutline size={14} aria-hidden />{readiness.label}</Badge>}
      {readiness?.state === 'partial' && <p className="text-xs font-medium text-sky-800">{readiness.label}</p>}
    </div>
  );
}
