'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import Link from 'next/link';
import * as api from 'src/services';
import { FiExternalLink } from 'react-icons/fi';
import { MdInbox } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import AddPaymentModal from './addPaymentModal';
import { fDateTime } from 'src/utils/formatTime';

const fmt = (n) => '৳' + Number(n || 0).toLocaleString();

function dtStr(d) {
  if (!d) return '—';
  return fDateTime(d);
}

function SourceBadge({ source }) {
  return source === 'webhook' ? (
    <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
      webhook
    </span>
  ) : (
    <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">manual</span>
  );
}

function AssignModal({ payment, onClose, onDone }) {
  const [orderNo, setOrderNo] = useState('');
  const { mutate, isLoading } = useMutation(() => api.assignPaymentByAdmin({ id: payment.id, orderNo }), {
    onSuccess: () => {
      onDone();
      onClose();
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || 'Failed';
      const alreadyOrderNo = e?.response?.data?.orderNo;
      Swal.fire('Error', alreadyOrderNo ? `${msg}: ${alreadyOrderNo}` : msg, 'error');
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm space-y-4 rounded-md bg-white p-6 shadow-xl">
        <h3 className="font-semibold text-slate-800">Assign to Order</h3>
        <div className="space-y-1 rounded-md bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-bold">{fmt(payment.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Type</span>
            <span className="font-mono uppercase">{payment.type}</span>
          </div>
          {payment.trxId && (
            <div className="flex justify-between">
              <span className="text-slate-500">TrxID</span>
              <span className="font-mono text-xs">{payment.trxId}</span>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Order No</label>
          <input
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="e.g. 1001"
            className="input-ui"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={() => mutate()} disabled={!orderNo.trim() || isLoading} className="btn-brand">
            {isLoading ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentList({ initialAddOpen = false }) {
  const [filters, setFilters] = useState({ unassigned: false, type: '' });
  const [addOpen, setAddOpen] = useState(initialAddOpen);
  const [assignTarget, setAssignTarget] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 20;
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery(
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
      render: (p) => <span className="text-xs font-semibold uppercase text-slate-700">{p.type}</span>
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (p) => <span className="whitespace-nowrap font-bold text-slate-800">{fmt(p.amount)}</span>
    },
    {
      key: 'trxId',
      label: 'TrxID',
      render: (p) => <span className="font-mono text-xs text-slate-500">{p.trxId || '—'}</span>
    },
    {
      key: 'account',
      label: 'Account',
      render: (p) => <span className="font-mono text-xs text-slate-500">{p.account || '—'}</span>
    },
    {
      key: 'note',
      label: 'Note',
      render: (p) => <span className="block max-w-[160px] truncate text-xs text-slate-500">{p.note || '—'}</span>
    },
    {
      key: 'createdBy',
      label: 'Created By',
      render: (p) => <span className="text-xs text-slate-500">{p.createdBy || '—'}</span>
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (p) => <span className="whitespace-nowrap text-xs text-slate-400">{dtStr(p.createdAt)}</span>
    },
    {
      key: 'order',
      label: 'Order',
      render: (p) =>
        p.orderNo ? (
          <Link
            href={`/orders/${p.orderNo}`}
            className="flex items-center gap-1 font-mono text-xs hover:underline"
            style={{ color: 'var(--brand-strong)' }}
          >
            #{p.orderNo}
            <FiExternalLink size={11} />
          </Link>
        ) : (
          <span className="text-xs text-amber-500">Unassigned</span>
        )
    },
    { key: 'source', label: 'Source', render: (p) => <SourceBadge source={p.source} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (p) =>
        !p.orderId && (
          <button
            onClick={() => setAssignTarget(p)}
            className="whitespace-nowrap rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-slate-50"
            style={{ color: 'var(--brand-strong)', borderColor: 'var(--brand-ring)' }}
          >
            Assign
          </button>
        )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" subtitle={`${data?.total ?? 0} total`}>
        <button onClick={() => setAddOpen(true)} className="btn-brand">
          + Manual Payment
        </button>
      </PageHeader>

      <ListToolbar
        refreshing={isFetching}
        onRefresh={refetch}
        onReset={() => {
          setFilters({ unassigned: false, type: '' });
          setPage(1);
        }}
      >
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={filters.unassigned}
            onChange={(e) => {
              setFilters((f) => ({ ...f, unassigned: e.target.checked }));
              setPage(1);
            }}
            className="h-4 w-4"
            style={{ accentColor: 'var(--brand)' }}
          />
          Unassigned only
        </label>
        <select
          value={filters.type}
          onChange={(e) => {
            setFilters((f) => ({ ...f, type: e.target.value }));
            setPage(1);
          }}
          className="select-ui"
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
        columns={columns}
        data={rows}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No payments found" icon={MdInbox} />}
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
