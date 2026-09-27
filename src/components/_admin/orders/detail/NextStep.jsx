'use client';

/**
 * The one thing to do next, at the top of the order.
 *
 * Every order screen visit is someone moving the order along. So the moves the
 * server allows right now sit in one bar with a sentence saying where the
 * order stands — not spread across the page. The ways out (cancel, return)
 * are in the header's More menu, where they cannot be pressed by accident.
 *
 * Blocked moves stay visible with the server's reason: a button that simply
 * vanished leaves people guessing.
 */

import { FiCheckCircle, FiLoader, FiPackage, FiTruck } from 'react-icons/fi';
import { PROVIDER_LABEL } from './parts';

const ICONS = { CONFIRM: FiCheckCircle, PACK: FiPackage, SHIP: FiTruck, DELIVER: FiCheckCircle };

/** Where the order stands, in one sentence. */
function headline(order, packing, activeShipment) {
  const scanned = packing?.total ? `${packing.verified || 0} of ${packing.total} pieces scanned` : null;
  const courier = activeShipment ? PROVIDER_LABEL[activeShipment.provider] || activeShipment.provider : null;
  switch (order.status) {
    case 'awaiting_payment':
      return { title: 'Waiting for payment', detail: 'Confirm it once the payment is checked.' };
    case 'pending':
      return { title: 'New order', detail: 'Check the details and confirm it.' };
    case 'confirmed':
    case 'processing':
      return { title: 'Confirmed', detail: scanned || 'Pieces are being prepared.' };
    case 'production-needed':
      return { title: 'Waiting on production', detail: 'Some pieces are still being made.' };
    case 'ready-to-pack':
      return { title: 'Ready to pack', detail: scanned ? `${scanned}. Press Pack to scan the rest.` : 'Press Pack and scan each piece into the parcel.' };
    case 'packed':
      return { title: 'Packed', detail: 'Send the parcel to a courier.' };
    case 'shipped':
      return { title: 'With the courier', detail: courier ? `Sent with ${courier}.` : 'On its way to the customer.' };
    case 'delivered':
    case 'completed':
      return { title: 'Delivered', detail: 'Nothing left to do unless the customer returns something.' };
    case 'cancelled':
    case 'canceled':
      return { title: 'Cancelled', detail: 'This order will not be fulfilled.' };
    case 'returned':
      return { title: 'Returned', detail: 'The parcel came back.' };
    default:
      return { title: order.status, detail: null };
  }
}

export default function NextStep({ order, packing, activeShipment, actions, busyAction, onAction, fallback }) {
  const { title, detail } = headline(order, packing, activeShipment);
  const progress = packing?.total ? Math.round(((packing.verified || 0) / packing.total) * 100) : null;
  const blocked = actions.filter((action) => !action.enabled && action.blockedBy);
  const showProgress = progress !== null && ['confirmed', 'processing', 'ready-to-pack'].includes(order.status);

  return (
    <section className="card-ui px-5 py-4" aria-label="Next step">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-900">{title}</p>
          {detail ? <p className="mt-0.5 text-[13px] text-slate-500">{detail}</p> : null}
          {showProgress ? (
            <span
              className="mt-2 block h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Pieces scanned"
            >
              <span className={`block h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-slate-900'}`} style={{ width: `${progress}%` }} />
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action, index) => {
            const Icon = ICONS[action.action] || FiCheckCircle;
            const busy = busyAction === action.action;
            // The first move the server offers is the main one; any others are secondary.
            const primary = index === 0 && action.intent !== 'default';
            return (
              <button
                key={action.action}
                type="button"
                onClick={() => onAction(action)}
                disabled={!action.enabled || Boolean(busyAction)}
                className={primary ? 'btn-brand' : 'btn-ghost'}
              >
                {busy ? <FiLoader size={16} className="animate-spin" aria-hidden /> : <Icon size={16} aria-hidden />}
                {busy ? 'Working…' : action.label}
              </button>
            );
          })}
          {fallback}
        </div>
      </div>

      {blocked.length ? (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {blocked.map((action) => (
            <li key={action.action} className="text-[13px] text-slate-600">
              <span className="font-medium text-slate-900">{action.label}:</span> {action.blockedBy}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
