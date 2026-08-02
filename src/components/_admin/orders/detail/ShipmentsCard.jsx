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

import { CopyButton, PROVIDER_LABEL, Pill, Section, SectionBody, money, oid } from './parts';

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
  prepared: 'Prepared — not yet sent to the courier.',
  submitting: 'Submission in progress. Do not re-send until this resolves.',
  failed: 'The courier rejected the submission.',
  requires_review: 'Needs review — the courier may already hold this parcel.'
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
    <Section
      title="Courier"
      icon={FiTruck}
      hint={shipments.length ? `${shipments.length} attempt${shipments.length === 1 ? '' : 's'}` : 'Not dispatched'}
      actions={
        <button
          type="button"
          onClick={onSend}
          disabled={!meta.canSend}
          title={meta.canSend ? sendLabel : 'The order must be packed before a parcel can be created.'}
          className="btn-ghost h-8 !px-2.5 !text-xs"
        >
          <FiTruck size={14} /> {sendLabel}
        </button>
      }
    >
      <SectionBody className="p-4">
        {shipments.length ? (
          <ul className="space-y-2">
            {shipments.map((shipment) => {
              const id = oid(shipment);
              const url = trackingUrl(shipment);
              const intentNote = INTENT_NOTE[shipment.intentStatus];

              return (
                <li
                  key={id}
                  className={`rounded-md border p-3 ${shipment.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/60'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-slate-800">
                        {PROVIDER_LABEL[shipment.provider] || shipment.provider}
                        <span className="font-medium text-slate-500">{shipment.accountName}</span>
                        {shipment.attempt > 1 ? <Pill tone="neutral">Attempt {shipment.attempt}</Pill> : null}
                        {!shipment.isActive ? <Pill tone="neutral">Superseded</Pill> : null}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-400">
                        {shipment.consignmentId ? (
                          <>
                            <span className="ops-code font-semibold text-slate-600">{shipment.consignmentId}</span>
                            <CopyButton value={shipment.consignmentId} label="Copy consignment ID" />
                            <span>·</span>
                          </>
                        ) : null}
                        <span>{money(shipment.codAmount)} COD</span>
                        {shipment.deliveryFee ? <span>· {money(shipment.deliveryFee)} fee</span> : null}
                        {shipment.createdAt ? <span>· {format(new Date(shipment.createdAt), 'dd MMM, hh:mm a')}</span> : null}
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
                        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      >
                        <FiRefreshCw size={13} className={refreshingId === id ? 'animate-spin' : ''} />
                      </button>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title="Track parcel"
                          aria-label="Track parcel"
                          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <FiExternalLink size={13} />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {intentNote ? (
                    <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700">
                      <FiAlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {intentNote}
                      {shipment.lastSubmissionError ? (
                        <span className="font-normal opacity-80"> {shipment.lastSubmissionError}</span>
                      ) : null}
                    </p>
                  ) : null}

                  {shipment.note ? <p className="mt-2 text-[11px] text-slate-500">Note: {shipment.note}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-2 text-sm text-slate-400">
            {meta.canSend
              ? 'No parcel created yet — send it to a courier when it leaves the table.'
              : 'No parcel yet. The order must be packed before a consignment can be created.'}
          </p>
        )}
      </SectionBody>
    </Section>
  );
}
