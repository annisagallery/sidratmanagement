'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { FiRefreshCw, FiPlus, FiEyeOff, FiAlertTriangle } from 'react-icons/fi';
import { MdInbox } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDateTime } from 'src/utils/formatTime';

const fmt = (n) => (n == null ? '—' : '৳' + Number(n).toLocaleString());
const dtStr = (d) => (d ? fDateTime(d) : '—');

const PARSE_STYLES = {
  parsed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  unrecognised: 'border-amber-200 bg-amber-50 text-amber-700',
  ignored: 'border-slate-200 bg-slate-50 text-slate-500'
};

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

function ParseBadge({ status }) {
  return (
    <span
      className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-xs ${
        PARSE_STYLES[status] || PARSE_STYLES.ignored
      }`}
    >
      {status}
    </span>
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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const { mutate, isLoading } = useMutation(
    () =>
      api.createPaymentFromSms({
        id: sms._id,
        ...form,
        amount: Number(form.amount)
      }),
    {
      onSuccess: () => {
        onDone();
        onClose();
        Swal.fire('Created', 'Payment recorded. Assign it to an order from the Payments tab.', 'success');
      },
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-lg space-y-4 rounded-md bg-white p-6 shadow-xl">
        <h3 className="font-semibold text-slate-800">Record payment from SMS</h3>

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">
            Original message from {sms.sender || 'unknown'}
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
            {sms.body}
          </pre>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Transaction ID</label>
            <input value={form.trxId} onChange={set('trxId')} className="input-ui" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
            <input type="number" value={form.amount} onChange={set('amount')} className="input-ui" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Method</label>
            <select value={form.type} onChange={set('type')} className="select-ui">
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
            {isLoading ? 'Saving…' : 'Create payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SmsInbox() {
  const [filters, setFilters] = useState({ status: 'unrecognised', search: '' });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [createFor, setCreateFor] = useState(null);
  const limit = 20;
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery(
    ['sms-messages', filters, page],
    () =>
      api.getSmsMessages({
        status: filters.status || undefined,
        search: filters.search || undefined,
        page,
        limit
      }),
    { staleTime: 15_000 }
  );

  const { data: statsData } = useQuery(['sms-stats'], api.getSmsStats, { staleTime: 30_000 });
  const { data: typesData } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, {
    staleTime: 5 * 60_000
  });
  const types = typesData?.data || [];
  const rows = data?.data || [];
  const stats = statsData?.data;

  const invalidate = () => {
    qc.invalidateQueries(['sms-messages']);
    qc.invalidateQueries(['sms-stats']);
    qc.invalidateQueries(['payments']);
    refetch();
  };

  const { mutate: reparse } = useMutation(api.reparseSms, {
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

  const { mutate: dismiss } = useMutation(api.dismissSms, { onSuccess: invalidate });

  const columns = [
    {
      key: 'receivedAt',
      label: 'Received',
      render: (m) => <span className="whitespace-nowrap text-xs text-slate-500">{dtStr(m.receivedAt)}</span>
    },
    {
      key: 'sender',
      label: 'From',
      render: (m) => <span className="text-xs font-semibold text-slate-700">{m.sender || '—'}</span>
    },
    {
      key: 'body',
      label: 'Message',
      render: (m) => (
        <button
          onClick={() => setExpanded(expanded === m._id ? null : m._id)}
          className="max-w-[280px] text-left text-xs text-slate-600 hover:underline"
        >
          {expanded === m._id ? (
            <span className="block whitespace-pre-wrap">{m.body}</span>
          ) : (
            <span className="block truncate">{m.body}</span>
          )}
        </button>
      )
    },
    { key: 'parseStatus', label: 'Parse', render: (m) => <ParseBadge status={m.parseStatus} /> },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (m) => <span className="whitespace-nowrap text-xs font-medium">{fmt(m.parsed?.amount)}</span>
    },
    {
      key: 'trxId',
      label: 'TrxID',
      render: (m) => <span className="font-mono text-xs text-slate-500">{m.parsed?.trxId || '—'}</span>
    },
    {
      key: 'reason',
      label: 'Note',
      render: (m) => (
        <span className="block max-w-[180px] text-xs text-slate-500">
          {m.parseReason ? REASON_LABELS[m.parseReason] || m.parseReason : m.ruleId || '—'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (m) => (
        <div className="flex items-center justify-end gap-1">
          {!m.payment && (
            <>
              <button
                onClick={() => reparse(m._id)}
                title="Re-run the rules over this message"
                className="rounded-md border px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                <FiRefreshCw size={12} />
              </button>
              <button
                onClick={() => setCreateFor(m)}
                title="Record a payment from this message"
                className="rounded-md border px-2 py-1 text-xs transition hover:bg-slate-50"
                style={{ color: 'var(--brand-strong)', borderColor: 'var(--brand-ring)' }}
              >
                <FiPlus size={12} />
              </button>
              {!m.reviewedAt && (
                <button
                  onClick={() => dismiss(m._id)}
                  title="Dismiss — not a payment"
                  className="rounded-md border px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-50"
                >
                  <FiEyeOff size={12} />
                </button>
              )}
            </>
          )}
          {m.payment && <span className="text-xs text-emerald-600">linked</span>}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="SMS Inbox"
        subtitle={
          stats
            ? `${stats.last24h.parsed} read · ${stats.last24h.unrecognised} unread · ${stats.last24h.ignored} ignored (24h)`
            : undefined
        }
      />

      {/* Unread credit-looking messages are the signal that operator wording
          drifted and the rule table needs a new entry. */}
      {stats?.pendingReview > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
          <span>
            <strong>{stats.pendingReview} message(s) could not be read.</strong> These are not
            lost — the original text is stored. Record the payment by hand, or add a parser rule
            and press re-parse.
          </span>
        </div>
      )}

      <ListToolbar
        refreshing={isFetching}
        onRefresh={refetch}
        onReset={() => {
          setFilters({ status: 'unrecognised', search: '' });
          setPage(1);
        }}
      >
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setPage(1);
          }}
          className="select-ui"
        >
          <option value="unrecognised">Could not read</option>
          <option value="parsed">Read successfully</option>
          <option value="ignored">Ignored</option>
          <option value="">All messages</option>
        </select>
        <input
          value={filters.search}
          onChange={(e) => {
            setFilters((f) => ({ ...f, search: e.target.value }));
            setPage(1);
          }}
          placeholder="Search text or TrxID…"
          className="input-ui max-w-[220px]"
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        data={rows}
        selectionLabel="messages"
        exportFileName="sms-inbox.csv"
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No messages" icon={MdInbox} />}
        footer={
          <Pagination
            page={page}
            totalPages={data?.pages || 1}
            onPage={setPage}
            total={data?.total || 0}
            unit="messages"
            pageSize={limit}
          />
        }
      />

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
