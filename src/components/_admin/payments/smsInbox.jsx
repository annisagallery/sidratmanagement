'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiEyeOff,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSmartphone
} from 'react-icons/fi';
import { MdInbox } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { fDateTime } from 'src/utils/formatTime';

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
  { key: 'parsed', label: 'Read', countKey: 'parsed' },
  { key: 'aside', label: 'Set aside', countKey: 'aside' },
  { key: 'all', label: 'All', countKey: 'all' }
];

// One reading of a message, used by both panes so the list and the pane can
// never disagree about what state something is in.
function readingOf(message) {
  if (message.paymentId) return { tone: 'emerald', label: 'Recorded' };
  if (message.parseStatus === 'parsed') return { tone: 'emerald', label: 'Read' };
  if (message.parseStatus === 'ignored') return { tone: 'slate', label: 'Ignored' };
  if (message.reviewedAt) return { tone: 'slate', label: 'Dismissed' };
  return { tone: 'amber', label: 'Could not read' };
}

const TONES = {
  emerald: { dot: 'bg-emerald-500', pill: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  amber: { dot: 'bg-amber-500', pill: 'border-amber-200 bg-amber-50 text-amber-700' },
  slate: { dot: 'bg-slate-300', pill: 'border-slate-200 bg-slate-50 text-slate-500' }
};

function StatusPill({ message }) {
  const reading = readingOf(message);
  return (
    <span className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${TONES[reading.tone].pill}`}>
      {reading.label}
    </span>
  );
}

function CreatePaymentModal({ sms, types, onClose, onDone }) {
  // Pre-fill from whatever the parser did manage to read, so the common case
  // is confirming a reading rather than retyping it.
  const [form, setForm] = useState({
    trxId: sms.parsedTrxId || '',
    amount: sms.parsedAmount || '',
    type: sms.provider || types[0]?.slug || '',
    account: sms.parsedAccount || '',
    senderAccount: sms.parsedSenderAccount || '',
    note: ''
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const { mutate, isLoading } = useMutation(
    () => api.createPaymentFromSms({ id: sms.id, ...form, amount: Number(form.amount) }),
    {
      onSuccess: () => {
        onDone();
        onClose();
        Swal.fire('Recorded', 'Payment recorded. Assign it to an order from the Payments tab.', 'success');
      },
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-lg space-y-4 rounded-md bg-white p-6 shadow-xl">
        <div>
          <h3 className="font-semibold text-slate-800">Record payment from SMS</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            The message stays the evidence. What you type here is the reading of it.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">
            Original message from {sms.sender || 'unknown'}
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
            {sms.body}
          </pre>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Transaction ID</label>
            <input value={form.trxId} onChange={set('trxId')} className="input-ui font-mono" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input type="number" value={form.amount} onChange={set('amount')} className="input-ui" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Method</label>
            <select value={form.type} onChange={set('type')} className="select-ui w-full">
              <option value="">Select…</option>
              {types.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Paid from</label>
            <input value={form.senderAccount} onChange={set('senderAccount')} className="input-ui" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Paid to</label>
            <input value={form.account} onChange={set('account')} className="input-ui" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
            <input value={form.note} onChange={set('note')} className="input-ui" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={!form.amount || !form.type || isLoading}
            className="btn-brand"
          >
            {isLoading ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── List rail ─────────────────────────────────────────────────────────────────

function MessageRow({ message, selected, onSelect }) {
  const reading = readingOf(message);
  const amount = fmtAmount(message.parsedAmount);

  return (
    <button
      type="button"
      onClick={() => onSelect(message.id)}
      aria-current={selected ? 'true' : undefined}
      className={`relative block w-full border-b border-slate-100 px-4 py-3 text-left transition ${
        selected ? 'bg-[var(--brand-soft)]' : 'hover:bg-slate-50'
      }`}
    >
      {/* The selected row is marked on the edge rather than by weight, so the
          rest of the row keeps saying what it said before it was opened. */}
      {selected && <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: 'var(--brand)' }} />}
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONES[reading.tone].dot}`} aria-hidden="true" />
          <span className="truncate text-[13px] font-semibold text-slate-800">{message.sender || 'Unknown sender'}</span>
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{shortTime(message.receivedAt)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{message.body}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {amount ? (
          <span className="text-xs font-semibold tabular-nums text-slate-700">{amount}</span>
        ) : (
          <span className="text-xs text-slate-300">no amount</span>
        )}
        {message.parsedTrxId && (
          <span className="truncate font-mono text-[11px] text-slate-400">{message.parsedTrxId}</span>
        )}
        {message.paymentId && <FiCheckCircle className="ml-auto shrink-0 text-emerald-500" size={13} />}
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
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={`mt-0.5 text-[13px] ${mono ? 'font-mono' : ''} ${
          empty ? (wanted ? 'text-amber-600' : 'text-slate-300') : 'font-medium text-slate-800'
        }`}
      >
        {empty ? (wanted ? 'not found' : '—') : value}
      </dd>
    </div>
  );
}

function ReadingPane({ message, onBack, onReparse, onDismiss, onRecord, busy }) {
  if (!message) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
        <MdInbox className="text-slate-200" size={40} />
        <p className="text-sm font-medium text-slate-500">Pick a message to read it</p>
        <p className="max-w-xs text-xs text-slate-400">
          Every message the collector phones forward is kept here in full, whether the rules could read it or not.
        </p>
      </div>
    );
  }

  const unread = message.parseStatus === 'unrecognised';
  const amount = fmtAmount(message.parsedAmount);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-start gap-3 border-b border-slate-100 p-4">
        <button type="button" onClick={onBack} className="btn-icon lg:hidden" aria-label="Back to messages">
          <FiArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-bold text-slate-900">{message.sender || 'Unknown sender'}</h2>
            <StatusPill message={message} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
            <span>{fDateTime(message.receivedAt)}</span>
            {message.device?.name && (
              <span className="flex items-center gap-1">
                <FiSmartphone size={11} /> {message.device.name}
              </span>
            )}
            {message.provider && <span className="uppercase tracking-wide">{message.provider}</span>}
          </p>
        </div>

        {!message.paymentId && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={onReparse} disabled={busy} className="btn-ghost h-8 px-3 text-xs">
              <FiRefreshCw size={13} /> Re-parse
            </button>
            <button type="button" onClick={onRecord} disabled={busy} className="btn-brand h-8 px-3 text-xs">
              <FiPlus size={13} /> Record payment
            </button>
            {!message.reviewedAt && (
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy}
                className="btn-icon h-8 w-8"
                title="Dismiss — not a payment"
                aria-label="Dismiss — not a payment"
              >
                <FiEyeOff size={14} />
              </button>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {/* The message exactly as the phone received it. It is never rewritten,
            so it stays the thing an argument about a payment is settled with. */}
        <article className="max-w-2xl rounded-md rounded-tl-none border border-slate-200 bg-slate-50 p-4">
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700">{message.body}</p>
        </article>

        {message.paymentId && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <span className="flex items-center gap-1.5 font-semibold">
              <FiCheckCircle size={14} /> Recorded as a payment
            </span>
            {message.payment?.trxId && <span className="font-mono text-xs">{message.payment.trxId}</span>}
            {message.payment?.amount != null && (
              <span className="text-xs tabular-nums">{fmtAmount(message.payment.amount)}</span>
            )}
            {message.payment?.orderNo && <span className="text-xs">Order {message.payment.orderNo}</span>}
          </div>
        )}

        {unread && message.parseReason && !message.paymentId && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-semibold">{REASON_LABELS[message.parseReason] || message.parseReason}</p>
            <p className="mt-0.5 text-xs">
              Nothing is lost — record the payment by hand, or add a parser rule and press Re-parse.
            </p>
          </div>
        )}

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            What the rules read
          </h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-slate-200 p-4 sm:grid-cols-3">
            <ParsedField label="Amount" value={amount} wanted={unread} />
            <ParsedField label="Transaction ID" value={message.parsedTrxId} mono wanted={unread} />
            <ParsedField label="Paid from" value={message.parsedSenderAccount} />
            <ParsedField label="Paid to" value={message.parsedAccount} />
            <ParsedField label="Fee" value={fmtAmount(message.parsedFee)} />
            <ParsedField label="Balance after" value={fmtAmount(message.parsedBalance)} />
            <ParsedField label="Reference" value={message.parsedReference} />
            <ParsedField label="Direction" value={message.direction} />
            <ParsedField label="Matched rule" value={message.ruleId} mono />
          </dl>
        </section>

        <p className="text-[11px] text-slate-400">
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
  const limit = 25;
  const qc = useQueryClient();

  const params = useMemo(
    () => ({
      pending: tab === 'pending' ? 'true' : undefined,
      status: tab === 'parsed' || tab === 'aside' ? tab : undefined,
      search: query || undefined,
      page,
      limit
    }),
    [tab, query, page]
  );

  const { data, isLoading, isFetching, refetch } = useQuery(
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
  };

  const { mutate: reparse, isLoading: reparsing } = useMutation(api.reparseSms, {
    onSuccess: (res) => {
      invalidate();
      Swal.fire(
        'Re-parsed',
        `Now reads as: ${res?.data?.parseStatus}${res?.matched ? ` · ${res.matched}` : ''}`,
        'info'
      );
    },
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const { mutate: dismiss, isLoading: dismissing } = useMutation(api.dismissSms, {
    onSuccess: invalidate,
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const submitSearch = (event) => {
    event.preventDefault();
    setQuery(search.trim());
    setPage(1);
  };

  const totalPages = data?.pages || 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment SMS"
        subtitle="Every message the collector phones forward, and what the rules made of it"
        icon={MdInbox}
      >
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-ghost">
          <FiRefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </PageHeader>

      <div className="card-ui flex min-h-[560px] flex-col overflow-hidden lg:h-[calc(100vh-13rem)]">
        {/* Filter and search sit above both panes: they choose what the rail
            holds, and the rail chooses what the pane reads. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          <nav className="flex flex-wrap gap-1" aria-label="Filter messages">
            {TABS.map((item) => {
              const active = tab === item.key;
              const count = counts[item.countKey];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setTab(item.key);
                    setPage(1);
                    setSelectedId(null);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    active ? 'text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  style={active ? { backgroundColor: 'var(--brand)' } : undefined}
                >
                  {item.label}
                  {count > 0 && (
                    <span
                      className={`rounded px-1 text-[11px] tabular-nums ${
                        active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <form onSubmit={submitSearch} className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[260px] sm:flex-none">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search text or TrxID…"
              className="input-ui h-8 pl-8 text-xs"
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
                <div className="space-y-px p-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-md bg-slate-100" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 p-8 text-center">
                  <MdInbox className="text-slate-200" size={32} />
                  <p className="text-sm font-medium text-slate-500">
                    {tab === 'pending' ? 'Nothing waiting on you' : 'No messages here'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {tab === 'pending'
                      ? 'Every message the rules could not read has been dealt with.'
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
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-icon h-7 w-7"
                  aria-label="Previous page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="text-[11px] tabular-nums text-slate-500">
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
            />
          </div>
        </div>
      </div>

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
