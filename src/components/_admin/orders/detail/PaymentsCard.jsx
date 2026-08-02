'use client';

/**
 * Money actually received against this order.
 *
 * The card answers one question first — is anything still owed — and only then
 * lists how the money arrived. "Add payment" lives in this header rather than a
 * far-away actions panel, because this is where someone looks when they are
 * about to record one.
 */

import { format } from 'date-fns';
import { FiCreditCard, FiDollarSign, FiPlus, FiX } from 'react-icons/fi';

import { CopyButton, Pill, Section, SectionBody, money, oid } from './parts';

const STATUS_TONE = { verified: 'good', failed: 'bad', refunded: 'warn' };

export default function PaymentsCard({ payments = [], total = 0, paid = 0, due = 0, onAdd, onRemove }) {
  return (
    <Section
      title="Payments"
      icon={FiCreditCard}
      hint={`${money(paid)} of ${money(total)} received`}
      actions={
        <button type="button" onClick={onAdd} className="btn-ghost h-8 !px-2.5 !text-xs">
          <FiPlus size={14} /> Add payment
        </button>
      }
    >
      <SectionBody className="p-4">
        {due > 0 ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Outstanding</span>
            <span className="text-sm font-black tabular-nums text-amber-700">{money(due)}</span>
          </div>
        ) : (
          <div className="mb-3 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Fully paid</span>
            <span className="text-sm font-black tabular-nums text-emerald-700">{money(paid)}</span>
          </div>
        )}

        {payments.length ? (
          <ul className="space-y-2">
            {payments.map((payment) => (
              <li
                key={oid(payment)}
                className="group flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <FiDollarSign size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold tabular-nums text-slate-800">
                      {money(payment.amount)}
                      <span className="ml-2 text-xs font-semibold capitalize text-slate-500">{payment.method}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-400">
                      {payment.createdAt ? <span>{format(new Date(payment.createdAt), 'dd MMM yyyy, hh:mm a')}</span> : null}
                      {payment.trxId ? (
                        <>
                          <span>·</span>
                          <span className="ops-code text-slate-500">{payment.trxId}</span>
                          <CopyButton value={payment.trxId} label="Copy transaction ID" />
                        </>
                      ) : null}
                      {payment.note ? <span>· {payment.note}</span> : null}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone={STATUS_TONE[payment.status] || 'warn'}>{payment.status || 'pending'}</Pill>
                  <button
                    type="button"
                    onClick={() => onRemove(oid(payment))}
                    aria-label="Remove payment"
                    title="Remove payment"
                    className="rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                  >
                    <FiX size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-slate-400">
            No payment recorded yet. Use <span className="font-semibold text-slate-500">Add payment</span> above once
            money is received.
          </p>
        )}
      </SectionBody>
    </Section>
  );
}
