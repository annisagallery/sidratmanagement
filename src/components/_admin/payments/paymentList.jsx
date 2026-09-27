'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { alertError, toastSuccess } from 'src/utils/swal';
import Link from 'next/link';
import * as api from 'src/services';
import { MdAdd, MdInbox } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import Segmented from 'src/components/_admin/ui/Segmented';
import Badge from 'src/components/_admin/ui/Badge';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { Field, ModalShell, fieldClass } from 'src/components/_admin/ui/primitives';
import AddPaymentModal from './addPaymentModal';
import { fDateTime } from 'src/utils/formatTime';

const fmt = (n) => '৳' + Number(n || 0).toLocaleString();

function dtStr(d) {
  if (!d) return '—';
  return fDateTime(d);
}

// "webhook" is how the record arrived, not something a person should have to
// decode: it means the system recorded it by itself — an SMS match or an
// outside system — as opposed to someone on staff entering it.
function SourceBadge({ source }) {
  return source === 'webhook' ? <Badge tone="violet">Automatic</Badge> : <Badge tone="info">Added by staff</Badge>;
}

function AssignModal({ payment, onClose, onDone }) {
  const [orderNo, setOrderNo] = useState('');
  const [error, setError] = useState('');
  const { mutate, isLoading } = useMutation(() => api.assignPaymentByAdmin({ id: payment.id, orderNo: orderNo.trim() }), {
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
      subtitle="Payments"
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
            <dd className="font-semibold tabular-nums text-slate-900">{fmt(payment.amount)}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-slate-500">Type</dt>
            <dd className="uppercase text-slate-900">{payment.type}</dd>
          </div>
          {payment.trxId && (
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-slate-500">Transaction ID</dt>
              <dd className="ops-code text-slate-900">{payment.trxId}</dd>
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
            placeholder="e.g. 1001"
            inputMode="numeric"
            className={`${fieldClass} ops-code`}
            autoFocus
          />
        </Field>
      </form>
    </ModalShell>
  );
}

export default function PaymentList({ initialAddOpen = false }) {
  const [filters, setFilters] = useState({ unassigned: false, type: '' });
  const [addOpen, setAddOpen] = useState(initialAddOpen);
  const [assignTarget, setAssignTarget] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 20;
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch, isError, error: loadError } = useQuery(
    ['payments', filters, page],
    () => api.getPaymentsByAdmin({ ...filters, unassigned: filters.unassigned || undefined, page, limit }),
    { staleTime: 30_000 }
  );

  const { data: typesData } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, { staleTime: 5 * 60_000 });
  const types = typesData?.data || [];
  const rows = data?.data || [];

  const invalidate = () => {
    qc.invalidateQueries(['payments']);
    refetch();
  };

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (p) => <span className="text-[13px] font-medium uppercase text-slate-900">{p.type}</span>
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (p) => <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{fmt(p.amount)}</span>
    },
    {
      key: 'trxId',
      label: 'Transaction ID',
      render: (p) => <span className="ops-code text-[13px] text-slate-700">{p.trxId || '—'}</span>
    },
    {
      key: 'account',
      label: 'Account',
      hideBelow: 'lg',
      render: (p) => <span className="ops-code text-[13px] text-slate-600">{p.account || '—'}</span>
    },
    {
      key: 'note',
      label: 'Note',
      hideBelow: 'xl',
      render: (p) => (
        <span className="block max-w-[180px] truncate text-[13px] text-slate-600" title={p.note || undefined}>
          {p.note || '—'}
        </span>
      )
    },
    {
      key: 'createdBy',
      label: 'Added by',
      hideBelow: 'xl',
      render: (p) => <span className="text-[13px] text-slate-600">{p.createdBy || '—'}</span>
    },
    {
      key: 'createdAt',
      label: 'Date',
      hideBelow: 'md',
      render: (p) => <span className="whitespace-nowrap text-[13px] text-slate-600">{dtStr(p.createdAt)}</span>
    },
    {
      key: 'order',
      label: 'Order',
      render: (p) =>
        p.orderNo ? (
          <Link href={`/orders/${p.orderNo}`} onClick={stopRow} className="ops-code text-[13px] font-semibold text-slate-900 hover:underline">
            #{p.orderNo}
          </Link>
        ) : (
          <Badge tone="warning">Unassigned</Badge>
        )
    },
    { key: 'source', label: 'Source', hideBelow: 'lg', render: (p) => <SourceBadge source={p.source} /> },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (p) =>
        !p.orderId && (
          <button type="button" onClick={() => setAssignTarget(p)} className="btn-ghost btn-sm">
            Assign
          </button>
        )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle={`${data?.total ?? 0} total`}>
        <button type="button" onClick={() => setAddOpen(true)} className="btn-brand">
          <MdAdd size={18} aria-hidden /> Add manual payment
        </button>
      </PageHeader>

      <ListToolbar
        refreshing={isFetching}
        onRefresh={refetch}
        onReset={
          filters.unassigned || filters.type
            ? () => {
                setFilters({ unassigned: false, type: '' });
                setPage(1);
              }
            : undefined
        }
      >
        <Segmented
          label="Show"
          options={[
            { id: 'all', label: 'All payments' },
            { id: 'unassigned', label: 'Unassigned' }
          ]}
          value={filters.unassigned ? 'unassigned' : 'all'}
          onChange={(v) => {
            setFilters((f) => ({ ...f, unassigned: v === 'unassigned' }));
            setPage(1);
          }}
        />
        <select
          value={filters.type}
          onChange={(e) => {
            setFilters((f) => ({ ...f, type: e.target.value }));
            setPage(1);
          }}
          className="select-ui"
          aria-label="Payment type"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        error={isError ? loadError : null}
        onRetry={refetch}
        columns={columns}
        data={rows}
        selectionLabel="payments"
        exportFileName="payments-selection.csv"
        isLoading={isLoading}
        isFetching={isFetching}
        empty={
          filters.unassigned || filters.type ? (
            <EmptyState title="No payments match" hint="Try another type, or show every payment." icon={MdInbox} />
          ) : (
            <EmptyState title="No payments yet" hint="Payments matched from SMS, and ones added by staff, appear here." icon={MdInbox} />
          )
        }
        footer={
          <Pagination
            page={page}
            totalPages={data?.pages || 1}
            onPage={setPage}
            total={data?.total || 0}
            unit="payments"
            pageSize={limit}
          />
        }
      />

      {addOpen && <AddPaymentModal types={types} onClose={() => setAddOpen(false)} onDone={invalidate} />}
      {assignTarget && <AssignModal payment={assignTarget} onClose={() => setAssignTarget(null)} onDone={invalidate} />}
    </div>
  );
}
