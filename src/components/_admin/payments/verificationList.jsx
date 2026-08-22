'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import Link from 'next/link';
import * as api from 'src/services';
import { FiExternalLink, FiAlertTriangle, FiCheck, FiX } from 'react-icons/fi';
import { MdInbox } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDateTime } from 'src/utils/formatTime';

const fmt = (n) => '৳' + Number(n || 0).toLocaleString();
const dtStr = (d) => (d ? fDateTime(d) : '—');

// Plain-language explanation of each machine reason code. A reviewer should
// never have to know what "outside_window" means internally.
const REASON_LABELS = {
  amount_mismatch: 'Amount does not match the invoice',
  trxid_not_found: 'No captured SMS carries this transaction ID',
  trxid_reused: 'This transaction ID was already used',
  sender_mismatch: 'Paid from a different number than claimed',
  account_mismatch: 'Paid to a different wallet or operator',
  outside_window: 'Payment timestamp is outside the invoice window',
  multiple_attempts: 'Customer tried several transaction IDs',
  high_value: 'Above the review threshold',
  unrecognised_sms: 'The SMS could not be read automatically'
};

const STATUS_STYLES = {
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  needs_review: 'border-amber-200 bg-amber-50 text-amber-700',
  awaiting_sms: 'border-sky-200 bg-sky-50 text-sky-700',
  awaiting_payment: 'border-slate-200 bg-slate-50 text-slate-600',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  expired: 'border-slate-200 bg-slate-50 text-slate-400'
};

function StatusBadge({ status }) {
  return (
    <span
      className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-xs ${
        STATUS_STYLES[status] || STATUS_STYLES.awaiting_payment
      }`}
    >
      {String(status || '').replace(/_/g, ' ')}
    </span>
  );
}

function ReasonList({ reasons = [] }) {
  if (!reasons.length) return <span className="text-xs text-slate-400">—</span>;
  return (
    <ul className="space-y-0.5">
      {reasons.map((r) => (
        <li key={r} className="flex items-start gap-1 text-xs text-amber-700">
          <FiAlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{REASON_LABELS[r] || r}</span>
        </li>
      ))}
    </ul>
  );
}

// One field, customer's claim beside the captured evidence. Disagreements are
// highlighted rather than merely listed, so the reviewer's eye lands on the
// discrepancy instead of scanning two columns of similar-looking numbers.
function CompareRow({ label, claimed, actual, mono }) {
  const has = claimed != null && actual != null;
  const differs = has && String(claimed) !== String(actual);
  const cell = `px-3 py-2 text-sm ${mono ? 'font-mono text-xs' : ''}`;
  return (
    <tr className={differs ? 'bg-rose-50' : ''}>
      <td className="px-3 py-2 text-xs font-medium text-slate-500">{label}</td>
      <td className={`${cell} ${differs ? 'font-semibold text-rose-700' : 'text-slate-700'}`}>
        {claimed ?? <span className="text-slate-300">not provided</span>}
      </td>
      <td className={`${cell} ${differs ? 'font-semibold text-rose-700' : 'text-slate-700'}`}>
        {actual ?? <span className="text-slate-300">no SMS</span>}
      </td>
    </tr>
  );
}

function ReviewModal({ intentId, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [chosenSms, setChosenSms] = useState(null);

  const { data, isLoading } = useQuery(
    ['payment-intent-review', intentId],
    () => api.getPaymentIntentReview(intentId),
    { enabled: !!intentId }
  );

  const review = data?.data;
  const intent = review?.intent;
  const claimed = review?.claimed;
  const actual = review?.actual;
  const candidates = review?.candidates || [];

  const { mutate, isLoading: saving } = useMutation(
    (action) =>
      api.reviewPaymentIntent({
        id: intentId,
        action,
        note: note.trim() || undefined,
        smsMessageId: chosenSms || undefined
      }),
    {
      onSuccess: (res, action) => {
        onDone();
        onClose();
        Swal.fire(
          action === 'approve' ? 'Approved' : 'Rejected',
          action === 'approve'
            ? `Payment linked to order #${res?.orderNo || intent?.orderNo}.`
            : 'The payment claim was rejected.',
          action === 'approve' ? 'success' : 'info'
        );
      },
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
    }
  );

  const confirmReject = () => {
    Swal.fire({
      title: 'Reject this payment claim?',
      text: 'The order stays unpaid and the transaction ID stays unused.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reject'
    }).then((r) => r.isConfirmed && mutate('reject'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-3xl space-y-4 rounded-md bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800">Verify payment</h3>
            {intent && (
              <p className="mt-0.5 text-sm text-slate-500">
                Order{' '}
                <Link
                  href={`/orders/${intent.orderNo}`}
                  className="font-mono hover:underline"
                  style={{ color: 'var(--brand-strong)' }}
                >
                  #{intent.orderNo}
                </Link>{' '}
                · {fmt(intent.amount)} · <span className="uppercase">{intent.type}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost" aria-label="Close">
            <FiX />
          </button>
        </div>

        {isLoading && <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}

        {intent && (
          <>
            {intent.reviewReason?.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1 text-xs font-semibold text-amber-800">
                  Why this needs a human
                </p>
                <ReasonList reasons={intent.reviewReason} />
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500" />
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                      Customer claimed
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                      SMS actually said
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <CompareRow label="Transaction ID" claimed={claimed?.trxId} actual={actual?.trxId} mono />
                  <CompareRow
                    label="Amount"
                    claimed={claimed?.amount != null ? fmt(claimed.amount) : null}
                    actual={actual?.amount != null ? fmt(actual.amount) : null}
                  />
                  <CompareRow
                    label="Paid from"
                    claimed={claimed?.senderAccount}
                    actual={actual?.senderAccount}
                    mono
                  />
                  <CompareRow label="Operator" claimed={claimed?.type} actual={actual?.type} />
                  <CompareRow label="Paid to" claimed={claimed?.account} actual={actual?.account} mono />
                  <CompareRow
                    label="Time"
                    claimed={claimed?.at ? dtStr(claimed.at) : null}
                    actual={actual?.at ? dtStr(actual.at) : null}
                  />
                </tbody>
              </table>
            </div>

            {/* The raw message is the evidence — show it verbatim rather than
                asking the reviewer to trust the parser's reading of it. */}
            {actual?.rawBody && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">
                  Original SMS from {actual.sender || 'unknown'}
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
                  {actual.rawBody}
                </pre>
              </div>
            )}

            {!actual && candidates.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">
                  No SMS matched this transaction ID. Captured payments for the same amount:
                </p>
                <div className="space-y-2">
                  {candidates.map((c) => (
                    <label
                      key={c._id}
                      className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs ${
                        chosenSms === c._id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="candidate"
                        checked={chosenSms === c._id}
                        onChange={() => setChosenSms(c._id)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-mono font-semibold">{c.parsed?.trxId}</span> ·{' '}
                        {fmt(c.parsed?.amount)} · from {c.parsed?.senderAccount || '—'} ·{' '}
                        {dtStr(c.receivedAt)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!actual && !candidates.length && (
              <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
                No captured SMS matches this claim. Approving is not possible until a matching
                message arrives — check the collector phone is online.
              </p>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Note <span className="text-slate-400">(recorded in the order history)</span>
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. confirmed with customer by phone"
                className="input-ui"
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button onClick={onClose} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={saving}
                className="rounded-md border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
              >
                Reject
              </button>
              <button
                onClick={() => mutate('approve')}
                disabled={saving || (!actual && !chosenSms)}
                className="btn-brand flex items-center gap-1 disabled:opacity-40"
              >
                <FiCheck size={14} />
                {saving ? 'Working…' : 'Approve & link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerificationList() {
  const [status, setStatus] = useState('needs_review');
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState(null);
  const limit = 20;
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery(
    ['payment-intents', status, page],
    () => api.getPaymentIntents({ status: status || undefined, page, limit }),
    { staleTime: 15_000 }
  );

  const rows = data?.data || [];
  const invalidate = () => {
    qc.invalidateQueries(['payment-intents']);
    qc.invalidateQueries(['payments']);
    refetch();
  };

  const columns = [
    {
      key: 'orderNo',
      label: 'Order',
      render: (i) =>
        i.orderNo ? (
          <Link
            href={`/orders/${i.orderNo}`}
            className="flex items-center gap-1 font-mono text-xs hover:underline"
            style={{ color: 'var(--brand-strong)' }}
          >
            #{i.orderNo}
            <FiExternalLink size={11} />
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (i) => <span className="whitespace-nowrap font-bold text-slate-800">{fmt(i.amount)}</span>
    },
    {
      key: 'type',
      label: 'Method',
      render: (i) => <span className="text-xs font-semibold uppercase text-slate-700">{i.type}</span>
    },
    {
      key: 'submittedTrxId',
      label: 'Claimed TrxID',
      render: (i) => <span className="font-mono text-xs text-slate-500">{i.submittedTrxId || '—'}</span>
    },
    {
      key: 'reviewReason',
      label: 'Problem',
      render: (i) => <ReasonList reasons={i.reviewReason} />
    },
    { key: 'status', label: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    {
      key: 'createdAt',
      label: 'Created',
      render: (i) => <span className="whitespace-nowrap text-xs text-slate-400">{dtStr(i.createdAt)}</span>
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (i) =>
        ['needs_review', 'awaiting_sms'].includes(i.status) && (
          <button
            onClick={() => setReviewId(i._id)}
            className="whitespace-nowrap rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-slate-50"
            style={{ color: 'var(--brand-strong)', borderColor: 'var(--brand-ring)' }}
          >
            Review
          </button>
        )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment Verification"
        subtitle={
          data?.pendingReview
            ? `${data.pendingReview} awaiting review`
            : 'Nothing awaiting review'
        }
      />

      <ListToolbar
        refreshing={isFetching}
        onRefresh={refetch}
        onReset={() => {
          setStatus('needs_review');
          setPage(1);
        }}
      >
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="select-ui"
        >
          <option value="needs_review">Needs review</option>
          <option value="awaiting_sms">Awaiting SMS</option>
          <option value="awaiting_payment">Awaiting payment</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="">All</option>
        </select>
      </ListToolbar>

      <DataTable
        columns={columns}
        data={rows}
        selectionLabel="invoices"
        exportFileName="payment-verification.csv"
        isLoading={isLoading || isFetching}
        empty={
          <EmptyState
            title="Nothing to verify"
            hint="Payments that match cleanly are linked automatically."
            icon={MdInbox}
          />
        }
        footer={
          <Pagination
            page={page}
            totalPages={data?.pages || 1}
            onPage={setPage}
            total={data?.total || 0}
            unit="invoices"
            pageSize={limit}
          />
        }
      />

      {reviewId && (
        <ReviewModal intentId={reviewId} onClose={() => setReviewId(null)} onDone={invalidate} />
      )}
    </div>
  );
}
