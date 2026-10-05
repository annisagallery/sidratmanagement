'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import * as api from 'src/services';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiEyeOff,
  FiLink,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSmartphone
} from 'react-icons/fi';
import Link from 'next/link';
import { MdInbox } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { fDateTime } from 'src/utils/formatTime';
import Segmented from 'src/components/_admin/ui/Segmented';
import Callout from 'src/components/_admin/ui/Callout';
import Badge from 'src/components/_admin/ui/Badge';
import { ErrorState } from 'src/components/_admin/ui/TableStates';
import { Field, ModalShell, fieldClass, selectClass } from 'src/components/_admin/ui/primitives';
import { toastSuccess, alertError } from 'src/utils/swal';

const fmtAmount = (value) =>
  value == null || value === '' ? null : '৳' + Number(value).toLocaleString();

// A timestamp answers "when exactly"; a triage list is read down the edge and
// only needs enough to tell one message from the next.
function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', ...(sameYear ? {} : { year: '2-digit' }) });
}

// Why a message was not read, in words a non-engineer can act on.
const REASON_LABELS = {
  missing_trxId: 'No transaction ID in the message',
  missing_amount: 'No amount in the message',
  missing_amount_trxId: 'No amount or transaction ID',
  no_matching_rule: 'Wording not recognised — a rule may be needed',
  ambiguous_rules: 'Two rules disagreed about this message',
  not_a_payment: 'Not a payment message',
  empty_body: 'Empty message'
};

// Named for what the operator has to do about them, not for what the parser
// called them: dismissing a message leaves its status alone, so a tab built on
// status would keep showing finished work as work still waiting.
const TABS = [
  { key: 'pending', label: 'Needs review', countKey: 'pending' },
  { key: 'unassigned', label: 'Unassigned', countKey: 'unassigned' },
  { key: 'parsed', label: 'Read', countKey: 'parsed' },
  { key: 'aside', label: 'Set aside', countKey: 'aside' },
  { key: 'all', label: 'All', countKey: 'all' }
];

// A customer's claim on this message (needs review or verified). Claimed money
// is the verifier's to decide, so the inbox never offers to assign it.
const claimOf = (message) => message.intents?.[0] || null;

// Money in and on no order: a read credit nobody booked or set aside, or a
// payment recorded from the message that was never put on an order.
function isUnassigned(message) {
  if (claimOf(message)) return false;
  if (message.paymentId) return !message.payment?.orderNo;
  return message.parseStatus === 'parsed' && message.direction === 'credit' && !message.reviewedAt;
}

// One reading of a message, used by both panes so the list and the pane can
// never disagree about what state something is in.
function readingOf(message) {
  const claim = claimOf(message);
  if (claim?.status === 'needs_review') return { tone: 'amber', label: 'In verification' };
  if (isUnassigned(message)) return { tone: 'amber', label: 'Unassigned' };
  if (message.paymentId || claim) return { tone: 'emerald', label: 'Recorded' };
  if (message.parseStatus === 'parsed') return { tone: 'emerald', label: 'Read' };
  if (message.parseStatus === 'ignored') return { tone: 'slate', label: 'Ignored' };
  if (message.reviewedAt) return { tone: 'slate', label: 'Dismissed' };
  return { tone: 'amber', label: 'Could not read' };
}

const TONES = {
  emerald: { dot: 'bg-emerald-500', badge: 'success' },
  amber: { dot: 'bg-amber-500', badge: 'warning' },
  slate: { dot: 'bg-slate-300', badge: 'neutral' }
};

function StatusPill({ message }) {
  const reading = readingOf(message);
  return (
    <Badge tone={TONES[reading.tone].badge} dot>
      {reading.label}
    </Badge>
  );
}

function CreatePaymentModal({ sms, types, onClose, onDone }) {
  // Pre-fill from whatever the parser did manage to read, so the common case
  // is confirming a reading rather than retyping it.
  const [form, setForm] = useState({
    trxId: sms.parsed?.trxId || '',
    amount: sms.parsed?.amount || '',
    type: sms.provider || types[0]?.slug || '',
    account: sms.parsed?.account || '',
    senderAccount: sms.parsed?.senderAccount || '',
    note: ''
  });

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const [errors, setErrors] = useState({});

  const { mutate, isLoading } = useMutation(
    () => api.createPaymentFromSms({ id: sms.id, ...form, amount: Number(form.amount) }),
    {
      onSuccess: () => {
        onDone();
        onClose();
        toastSuccess('Payment recorded', 'Assign it to an order from Payments.');
      },
      onError: (e) => alertError(e, { title: 'The payment was not recorded' })
    }
  );

  const submit = () => {
    const next = {};
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Enter the amount.';
    if (!form.type) next.type = 'Choose the payment method.';
    setErrors(next);
    if (!Object.keys(next).length) mutate();
  };

  return (
    <ModalShell
      title="Record payment from SMS"
      subtitle="SMS inbox"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={isLoading}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={isLoading} className="btn-brand">
            {isLoading ? 'Recording…' : 'Record payment'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-slate-800">Message from {sms.sender || 'an unknown sender'}</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-800 ring-1 ring-inset ring-slate-200">
            {sms.body}
          </pre>
          <p className="mt-1.5 text-[13px] text-slate-500">The message stays the evidence. What you enter below is your reading of it.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Transaction ID" className="sm:col-span-2">
            <input value={form.trxId} onChange={set('trxId')} className={`${fieldClass} ops-code`} spellCheck={false} />
          </Field>
          <Field label="Amount (৳)" required error={errors.amount}>
            <input type="number" inputMode="decimal" value={form.amount} onChange={set('amount')} className={`${fieldClass} tabular-nums`} />
          </Field>
          <Field label="Method" required error={errors.type}>
            <select value={form.type} onChange={set('type')} className={selectClass}>
              <option value="">Choose…</option>
              {types.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Paid from" optional>
            <input value={form.senderAccount} onChange={set('senderAccount')} className={`${fieldClass} ops-code`} />
          </Field>
          <Field label="Paid to" optional>
            <input value={form.account} onChange={set('account')} className={`${fieldClass} ops-code`} />
          </Field>
          <Field label="Note" optional className="sm:col-span-2">
            <input value={form.note} onChange={set('note')} className={fieldClass} />
          </Field>
        </div>
      </div>
    </ModalShell>
  );
}

// Staff supply only the order: the amount, method and trxId are what the SMS
// says, so there is nothing to retype and nothing to get wrong.
function AssignModal({ sms, onClose, onDone }) {
  const [orderNo, setOrderNo] = useState('');
  const [error, setError] = useState('');
  const amount = sms.payment?.amount ?? sms.parsed?.amount;
  const trxId = sms.payment?.trxId || sms.parsed?.trxId;

  const { mutate, isLoading } = useMutation(() => api.assignSmsToOrder({ id: sms.id, orderNo: orderNo.trim() }), {
    onSuccess: () => {
      toastSuccess('Payment assigned', `Now counted against order #${orderNo.trim()}.`);
      onDone();
      onClose();
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || 'The payment was not assigned.';
      const alreadyOrderNo = e?.response?.data?.orderNo;
      alertError(null, { title: 'The payment was not assigned', text: alreadyOrderNo ? `${msg}: ${alreadyOrderNo}` : msg });
    }
  });

  const submit = (e) => {
    e?.preventDefault?.();
    if (!orderNo.trim()) {
      setError('Enter the order number.');
      return;
    }
    mutate();
  };

  return (
    <ModalShell
      title="Assign to an order"
      subtitle="SMS inbox"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={isLoading}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={isLoading} className="btn-brand">
            {isLoading ? 'Assigning…' : 'Assign payment'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-[13px]">
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-slate-500">Amount</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{fmtAmount(amount) || '—'}</dd>
          </div>
          {sms.provider && (
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-slate-500">Method</dt>
              <dd className="uppercase text-slate-900">{sms.provider}</dd>
            </div>
          )}
          {trxId && (
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-slate-500">Transaction ID</dt>
              <dd className="ops-code text-slate-900">{trxId}</dd>
            </div>
          )}
          {sms.parsed?.senderAccount && (
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-slate-500">Paid from</dt>
              <dd className="ops-code text-slate-900">{sms.parsed.senderAccount}</dd>
            </div>
          )}
        </dl>
        <Field label="Order number" required error={error}>
          <input
            value={orderNo}
            onChange={(e) => {
              setOrderNo(e.target.value);
              setError('');
            }}
            className={`${fieldClass} ops-code`}
            spellCheck={false}
            autoFocus
          />
        </Field>
        <p className="text-[13px] text-slate-500">The customer gets the usual payment-received SMS.</p>
      </form>
    </ModalShell>
  );
}

// ── List rail ─────────────────────────────────────────────────────────────────

function MessageRow({ message, selected, onSelect }) {
  const reading = readingOf(message);
  const amount = fmtAmount(message.parsed?.amount);

  return (
    <button
      type="button"
      onClick={() => onSelect(message.id)}
      aria-current={selected ? 'true' : undefined}
      className={`relative block w-full border-b border-slate-100 px-4 py-3 text-left transition ${
        selected ? 'bg-slate-50' : 'hover:bg-slate-50'
      }`}
    >
      {/* The selected row is marked on the edge rather than by weight, so the
          rest of the row keeps saying what it said before it was opened. */}
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-slate-900" aria-hidden />}
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONES[reading.tone].dot}`} aria-hidden="true" />
          <span className="truncate text-[13px] font-semibold text-slate-800">{message.sender || 'Unknown sender'}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{shortTime(message.receivedAt)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{message.body}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {amount ? (
          <span className="text-xs font-semibold tabular-nums text-slate-700">{amount}</span>
        ) : (
          <span className="text-xs text-slate-400">no amount</span>
        )}
        {message.parsed?.trxId && (
          <span className="ops-code truncate text-xs text-slate-500">{message.parsed?.trxId}</span>
        )}
        {message.payment?.orderNo && (
          <FiCheckCircle className="ml-auto shrink-0 text-emerald-600" size={14} aria-label="Recorded as a payment" />
        )}
      </div>
    </button>
  );
}

// ── Reading pane ──────────────────────────────────────────────────────────────

// The parser's reading, field by field. An empty slot is drawn rather than
// skipped: what is missing is the whole reason a message lands in review, so
// it has to be as visible as what was found.
function ParsedField({ label, value, mono = false, wanted = false }) {
  const empty = value == null || value === '';
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 text-[13px] ${mono ? 'font-mono' : ''} ${
          empty ? (wanted ? 'font-medium text-amber-800' : 'text-slate-400') : 'font-medium text-slate-900'
        }`}
      >
        {empty ? (wanted ? 'not found' : '—') : value}
      </dd>
    </div>
  );
}

function ReadingPane({ message, onBack, onReparse, onDismiss, onRecord, onAssign, busy }) {
  if (!message) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
        <MdInbox className="text-slate-300" size={40} aria-hidden />
        <p className="text-sm font-medium text-slate-900">Choose a message to read it</p>
        <p className="max-w-xs text-[13px] text-slate-500">
          Every message the collector phones forward is kept here in full, whether the rules could read it or not.
        </p>
      </div>
    );
  }

  const unread = message.parseStatus === 'unrecognised';
  const amount = fmtAmount(message.parsed?.amount);
  const claim = claimOf(message);
  const unassigned = isUnassigned(message);
  // Recording by hand is for a message the rules could not read. A read
  // message already is its payment — recording it with no order would book the
  // trxId and turn the customer's later claim into a "reused" flag — so it is
  // assigned to an order instead.
  const canRecord = unread && !message.paymentId;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-start gap-3 border-b border-slate-200 px-5 py-4">
        <button type="button" onClick={onBack} className="btn-icon lg:hidden" aria-label="Back to messages">
          <FiArrowLeft size={16} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold text-slate-900">{message.sender || 'Unknown sender'}</h2>
            <StatusPill message={message} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-slate-500">
            <span>{fDateTime(message.receivedAt)}</span>
            {message.device?.name && (
              <span className="flex items-center gap-1">
                <FiSmartphone size={13} aria-hidden /> {message.device.name}
              </span>
            )}
            {message.provider && <Badge>{message.provider}</Badge>}
          </p>
        </div>

        {(!message.paymentId || unassigned) && !claim && (
          <div className="flex flex-wrap items-center gap-1.5">
            {!message.paymentId && (
              <button type="button" onClick={onReparse} disabled={busy} className="btn-ghost btn-sm">
                <FiRefreshCw size={14} aria-hidden /> Read again
              </button>
            )}
            {unassigned && (
              <button type="button" onClick={onAssign} disabled={busy} className="btn-brand btn-sm">
                <FiLink size={14} aria-hidden /> Assign to order
              </button>
            )}
            {canRecord && (
              <button type="button" onClick={onRecord} disabled={busy} className="btn-brand btn-sm">
                <FiPlus size={14} aria-hidden /> Record payment
              </button>
            )}
            {!message.paymentId && !message.reviewedAt && (
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy}
                className="btn-ghost btn-sm"
                title="Not a payment — set it aside"
              >
                <FiEyeOff size={14} aria-hidden /> Set aside
              </button>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {/* The message exactly as the phone received it. It is never rewritten,
            so it stays the thing an argument about a payment is settled with. */}
        <article className="max-w-2xl rounded-lg rounded-tl-none bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{message.body}</p>
        </article>

        {claim?.status === 'needs_review' && (
          <Callout tone="warning" title="A customer has claimed this payment">
            Order {claim.orderNo || '—'} submitted this transaction ID, and it is waiting for a decision under{' '}
            <Link href="/payments/verification" className="font-semibold underline">
              Payments → Verification
            </Link>
            .
          </Callout>
        )}

        {unassigned && !message.paymentId && (
          <Callout tone="warning" title="Unassigned payment">
            This money arrived but no customer has claimed it, so it is on no order. Assign it to the order it pays for, or set it
            aside if it is not a customer payment.
          </Callout>
        )}

        {message.paymentId && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900" role="status">
            <span className="flex items-center gap-1.5 font-semibold">
              <FiCheckCircle size={15} aria-hidden /> Recorded as a payment
            </span>
            {message.payment?.trxId && <span className="ops-code text-xs">{message.payment.trxId}</span>}
            {message.payment?.amount != null && (
              <span className="text-xs tabular-nums">{fmtAmount(message.payment.amount)}</span>
            )}
            {message.payment?.orderNo ? (
              <span className="text-xs">Order {message.payment.orderNo}</span>
            ) : (
              <span className="text-xs font-semibold text-amber-800">Not on an order yet</span>
            )}
          </div>
        )}

        {message.balanceStatus === 'unverified' && (
          <Callout tone="warning" title="Balance not verified">
            {message.balanceReason} This message cannot verify a payment on its own. If money moved outside these SMS, set the
            wallet balance again under Payments → Devices.
          </Callout>
        )}
        {message.balanceStatus === 'verified' && (
          <p className="text-[13px] text-emerald-700">
            Balance verified — chains from the wallet&apos;s last verified balance
            {message.simSlot ? ` on SIM ${message.simSlot}` : ''}.
          </p>
        )}

        {unread && message.parseReason && !message.paymentId && (
          <Callout tone="warning" title={REASON_LABELS[message.parseReason] || message.parseReason}>
            Nothing is lost — record the payment by hand, or add a reading rule and press Read again.
          </Callout>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">What the rules read</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-3">
            <ParsedField label="Amount" value={amount} wanted={unread} />
            <ParsedField label="Transaction ID" value={message.parsed?.trxId} mono wanted={unread} />
            <ParsedField label="Paid from" value={message.parsed?.senderAccount} />
            <ParsedField label="Paid to" value={message.parsed?.account} />
            <ParsedField label="Fee" value={fmtAmount(message.parsed?.fee)} />
            <ParsedField label="Balance after" value={fmtAmount(message.parsed?.balance)} />
            <ParsedField label="Reference" value={message.parsed?.reference} />
            <ParsedField label="Direction" value={message.direction} />
            <ParsedField label="Matched rule" value={message.ruleId} mono />
          </dl>
        </section>

        <p className="text-xs text-slate-500">
          Received on SIM {message.simSlot ?? '—'}
          {message.reparseCount > 0 && ` · re-parsed ${message.reparseCount}×`}
          {message.reviewedAt && ` · dismissed by ${message.reviewedBy || 'an admin'}`}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SmsInbox() {
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [createFor, setCreateFor] = useState(null);
  const [assignFor, setAssignFor] = useState(null);
  const limit = 25;
  const qc = useQueryClient();

  const params = useMemo(
    () => ({
      pending: tab === 'pending' ? 'true' : undefined,
      status: ['parsed', 'aside', 'unassigned'].includes(tab) ? tab : undefined,
      search: query || undefined,
      page,
      limit
    }),
    [tab, query, page]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery(
    ['sms-messages', params],
    () => api.getSmsMessages(params),
    { keepPreviousData: true, staleTime: 15_000 }
  );

  const { data: typesData } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, {
    staleTime: 5 * 60_000
  });

  const rows = data?.data || [];
  const counts = data?.counts || {};
  const types = typesData?.data || [];

  // Two different questions, and conflating them is what makes a two-pane
  // layout awkward on a phone. `picked` is what the operator chose; `open` is
  // what the pane reads, which falls back to the first message so a desktop
  // pane is never empty for no reason. The phone shows the rail until
  // something is picked, and the pane only after.
  const picked = rows.find((message) => message.id === selectedId) || null;
  const open = picked || rows[0] || null;

  const invalidate = () => {
    qc.invalidateQueries(['sms-messages']);
    qc.invalidateQueries(['sms-stats']);
    qc.invalidateQueries(['payments']);
    qc.invalidateQueries(['payment-intents']);
  };

  const { mutate: reparse, isLoading: reparsing } = useMutation(api.reparseSms, {
    onSuccess: (res) => {
      invalidate();
      toastSuccess('Message re-read', `Now reads as ${res?.data?.parseStatus}${res?.matched ? ` · ${res.matched}` : ''}`);
    },
    onError: (e) => alertError(e, { title: 'The message was not read again' })
  });

  const { mutate: dismiss, isLoading: dismissing } = useMutation(api.dismissSms, {
    onSuccess: () => {
      toastSuccess('Message set aside');
      invalidate();
    },
    onError: (e) => alertError(e, { title: 'The message was not set aside' })
  });

  const submitSearch = (event) => {
    event.preventDefault();
    setQuery(search.trim());
    setPage(1);
  };

  const totalPages = data?.pages || 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Payment SMS" subtitle="Every message the collector phones forward, and what the rules made of it.">
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-ghost">
          <FiRefreshCw size={14} className={isFetching ? 'animate-spin' : ''} aria-hidden /> Refresh
        </button>
      </PageHeader>

      <div className="card-ui flex min-h-[560px] flex-col overflow-hidden lg:h-[calc(100vh-13rem)]">
        {/* Filter and search sit above both panes: they choose what the rail
            holds, and the rail chooses what the pane reads. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Segmented
            label="Show"
            size="sm"
            options={TABS.map((item) => ({
              id: item.key,
              label: counts[item.countKey] > 0 ? `${item.label} ${counts[item.countKey]}` : item.label
            }))}
            value={tab}
            onChange={(key) => {
              setTab(key);
              setPage(1);
              setSelectedId(null);
            }}
            className="max-w-full overflow-x-auto"
          />

          <form onSubmit={submitSearch} className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[260px] sm:flex-none">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search text or transaction ID…"
              className="input-ui pl-9"
              aria-label="Search messages"
            />
          </form>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            className={`flex min-h-0 flex-col border-slate-200 lg:w-[22rem] lg:shrink-0 lg:border-r ${
              picked ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-4" aria-busy="true">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="skeleton h-16" />
                  ))}
                </div>
              ) : isError && !rows.length ? (
                <div className="p-4">
                  <ErrorState error={error} title="Messages could not be loaded" onRetry={refetch} />
                </div>
              ) : rows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 p-8 text-center">
                  <MdInbox className="text-slate-300" size={32} aria-hidden />
                  <p className="text-sm font-medium text-slate-900">
                    {tab === 'pending' ? 'Nothing waiting on you' : tab === 'unassigned' ? 'No unassigned payments' : 'No messages here'}
                  </p>
                  <p className="text-[13px] text-slate-500">
                    {tab === 'pending'
                      ? 'Every message the rules could not read has been dealt with.'
                      : tab === 'unassigned'
                        ? 'Every payment that arrived is on an order or in verification.'
                        : 'Try another tab, or clear the search.'}
                  </p>
                </div>
              ) : (
                rows.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    selected={message.id === open?.id}
                    onSelect={setSelectedId}
                  />
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-icon h-7 w-7"
                  aria-label="Previous page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="text-xs tabular-nums text-slate-500">
                  Page {page} of {totalPages} · {data?.total || 0} messages
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-icon h-7 w-7"
                  aria-label="Next page"
                >
                  <FiChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          <div className={`min-h-0 min-w-0 flex-1 ${picked ? 'flex' : 'hidden lg:flex'}`}>
            <ReadingPane
              message={open}
              busy={reparsing || dismissing}
              onBack={() => setSelectedId(null)}
              onReparse={() => reparse(open.id)}
              onDismiss={() => dismiss(open.id)}
              onRecord={() => setCreateFor(open)}
              onAssign={() => setAssignFor(open)}
            />
          </div>
        </div>
      </div>

      {assignFor && <AssignModal sms={assignFor} onClose={() => setAssignFor(null)} onDone={invalidate} />}

      {createFor && (
        <CreatePaymentModal
          sms={createFor}
          types={types}
          onClose={() => setCreateFor(null)}
          onDone={invalidate}
        />
      )}
    </div>
  );
}
