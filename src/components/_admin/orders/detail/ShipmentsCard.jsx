'use client';

/**
 * Every attempt to get this parcel to the customer.
 *
 * A shipment document exists before the courier is contacted, so the intent
 * state matters as much as the delivery state: a parcel stuck in `submitting`
 * or `requires_review` may or may not have reached the courier, and that has to
 * be visible here rather than inferred from a missing consignment number.
 */

import { format } from 'date-fns';
import { FiAlertTriangle, FiExternalLink, FiRefreshCw, FiTruck } from 'react-icons/fi';

import { Card, CopyButton, PROVIDER_LABEL, Pill, money, oid } from './parts';

const STATUS_META = {
  pending: { label: 'Awaiting pickup', tone: 'neutral' },
  in_transit: { label: 'In transit', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'good' },
  partial_delivered: { label: 'Partly delivered', tone: 'warn' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
  returned: { label: 'Returned', tone: 'warn' },
  hold: { label: 'On hold', tone: 'warn' },
  unknown: { label: 'Unknown', tone: 'neutral' }
};

/** Intent states worth saying out loud; `submitted` is the silent normal case. */
const INTENT_NOTE = {
  prepared: 'Not sent to the courier yet',
  submitting: 'Sending to the courier…',
  failed: 'Rejected by the courier',
  requires_review: 'Needs review — the courier may already have it'
};

export function ShipmentStatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

function trackingUrl(shipment) {
  if (shipment.provider === 'steadfast' && shipment.trackingCode) {
    return `https://steadfast.com.bd/t/${shipment.trackingCode}`;
  }
  return null;
}

export default function ShipmentsCard({
  shipments = [],
  meta = {},
  onSend,
  onRefresh,
  refreshingId = null,
  sendLabel = 'Send parcel'
}) {
  return (
    <Card
      title="Shipping"
      icon={FiTruck}
      badge={shipments.length > 1 ? <span className="text-[13px] text-slate-500">{shipments.length} attempts</span> : null}
      actions={
        <button
          type="button"
          onClick={onSend}
          disabled={!meta.canSend}
          title={meta.canSend ? sendLabel : 'Pack the order first'}
          className="btn-ghost btn-sm"
        >
          <FiTruck size={14} aria-hidden /> {sendLabel}
        </button>
      }
    >
      <div className="border-t border-slate-100 px-5 py-4">
        {shipments.length ? (
          <ul className="space-y-2">
            {shipments.map((shipment) => {
              const id = oid(shipment);
              const url = trackingUrl(shipment);
              const intentNote = INTENT_NOTE[shipment.intentStatus];

              return (
                <li
                  key={id}
                  className={`rounded-lg border p-3 ${shipment.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/60 opacity-75'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-slate-800">
                        {PROVIDER_LABEL[shipment.provider] || shipment.provider}
                        <span className="font-medium text-slate-500">{shipment.accountName}</span>
                        {shipment.attempt > 1 ? <Pill tone="neutral">Attempt {shipment.attempt}</Pill> : null}
                        {!shipment.isActive ? <Pill tone="neutral">Superseded</Pill> : null}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                        {shipment.consignmentId ? (
                          <>
                            <span className="ops-code font-semibold text-slate-600">{shipment.consignmentId}</span>
                            <CopyButton value={shipment.consignmentId} label="Copy consignment ID" />
                            <span>·</span>
                          </>
                        ) : null}
                        <span>{money(shipment.codAmount)} COD</span>
                        {shipment.deliveryFee ? <span>· {money(shipment.deliveryFee)} fee</span> : null}
                        {shipment.createdAt ? (
                          <span>· {format(new Date(shipment.createdAt), 'dd MMM, hh:mm a')}</span>
                        ) : null}
                        {shipment.createdBy?.name ? <span>· by {shipment.createdBy.name}</span> : null}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <ShipmentStatusPill status={shipment.status} />
                      <button
                        type="button"
                        onClick={() => onRefresh(id)}
                        disabled={refreshingId === id}
                        title="Refresh status from the courier"
                        aria-label="Refresh status from the courier"
                        className="btn-icon btn-icon-sm disabled:opacity-50"
                      >
                        <FiRefreshCw size={15} className={refreshingId === id ? 'animate-spin' : ''} aria-hidden />
                      </button>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title="Track parcel"
                          aria-label="Track this parcel on Steadfast (opens in a new tab)"
                          className="btn-icon btn-icon-sm"
                        >
                          <FiExternalLink size={15} aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {intentNote ? (
                    <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900">
                      <FiAlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                      {intentNote}
                      {shipment.lastSubmissionError ? (
                        <span className="font-normal opacity-80"> {shipment.lastSubmissionError}</span>
                      ) : null}
                    </p>
                  ) : null}

                  {shipment.note ? <p className="mt-2 text-xs text-slate-500">Note: {shipment.note}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-slate-500">
            {meta.canSend ? 'No parcel yet — send it to a courier when you are ready.' : 'No parcel yet. It can be sent once the order is packed.'}
          </p>
        )}
      </div>
    </Card>
  );
}
