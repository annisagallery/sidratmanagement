'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Link from 'next/link';
import { getAllCashTransactions } from 'src/services';
import { MdSwapHoriz, MdAdd } from 'react-icons/md';
import CashModal from './_CashModal';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDateTime } from 'src/utils/formatTime';

const BDT = '৳';

const TYPE_LABELS = {
  earned: { label: 'Earned', cls: 'bg-emerald-100 text-emerald-700' },
  spent: { label: 'Spent', cls: 'bg-orange-100 text-orange-700' },
  manual_credit: { label: 'Manual Credit', cls: 'bg-sky-100 text-sky-700' },
  manual_debit: { label: 'Manual Debit', cls: 'bg-red-100 text-red-600' },
  expired: { label: 'Expired', cls: 'bg-slate-100 text-slate-500' }
};

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'earned', label: 'Earned' },
  { value: 'spent', label: 'Spent at Checkout' },
  { value: 'manual_credit', label: 'Manual Credit' },
  { value: 'manual_debit', label: 'Manual Debit' },
  { value: 'expired', label: 'Expired' }
];

function fmtDate(d) {
  if (!d) return '—';
  return fDateTime(d);
}

export default function CashTransactions() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery(
    ['cash-transactions', page, typeFilter, activeSearch],
    () => getAllCashTransactions(page, typeFilter, activeSearch),
    { keepPreviousData: true }
  );

  const transactions = data?.data || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const onDone = () => qc.invalidateQueries('cash-transactions');

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (tx) =>
        tx.user ? (
          <Link href={`/users/${encodeURIComponent(tx.user.phone)}`} className="block hover:underline">
            <p className="text-[13px] font-semibold text-slate-800">{tx.user.name || '—'}</p>
            <p className="text-xs text-slate-400">{tx.user.phone}</p>
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )
    },
    {
      key: 'type',
      label: 'Type',
      render: (tx) => {
        const meta = TYPE_LABELS[tx.type] || { label: tx.type, cls: 'bg-slate-100 text-slate-500' };
        return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>;
      }
    },
    { key: 'description', label: 'Message', render: (tx) => <span className="block max-w-[160px] truncate text-xs text-slate-500">{tx.description || '—'}</span> },
    { key: 'order', label: 'Order', render: (tx) => (tx.order?.orderNo ? <span className="font-mono text-xs text-slate-600">#{tx.order.orderNo}</span> : <span className="text-xs text-slate-400">—</span>) },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (tx) => {
        const isDebit = tx.type === 'spent' || tx.type === 'manual_debit' || tx.type === 'expired';
        return (
          <span className={`font-bold ${isDebit ? 'text-red-500' : 'text-emerald-600'}`}>
            {isDebit ? '-' : '+'}
            {BDT}
            {tx.amount?.toLocaleString()}
          </span>
        );
      }
    },
    { key: 'balanceAfter', label: 'Balance After', align: 'right', render: (tx) => <span className="font-semibold text-slate-700">{BDT}{(tx.balanceAfter || 0).toLocaleString()}</span> },
    { key: 'creator', label: 'Created By', render: (tx) => <span className="text-xs text-slate-500">{tx.creator?.name || <span className="text-slate-400">System</span>}</span> },
    { key: 'createdAt', label: 'Date', align: 'right', render: (tx) => <span className="whitespace-nowrap text-xs text-slate-400">{fmtDate(tx.createdAt)}</span> }
  ];

  return (
    <div className="space-y-4">
      {showModal && <CashModal onClose={() => setShowModal(false)} onDone={onDone} />}

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => {
          setPage(1);
          setActiveSearch(search);
        }}
        searchPlaceholder="Search by user name or phone…"
        right={
          <button onClick={() => setShowModal(true)} className="btn-brand">
            <MdAdd size={18} /> Give Cashback
          </button>
        }
      >
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="select-ui min-w-[150px]">
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </ListToolbar>

      <p className="text-xs text-slate-400">
        {isFetching && !isLoading ? 'Refreshing…' : `${total.toLocaleString()} transaction${total !== 1 ? 's' : ''}`}
        {activeSearch && <span> matching "<strong>{activeSearch}</strong>"</span>}
        {typeFilter && <span> · {TYPE_LABELS[typeFilter]?.label}</span>}
      </p>

      <DataTable
        columns={columns}
        data={transactions}
        isLoading={isLoading}
        empty={<EmptyState title="No transactions found" icon={MdSwapHoriz} />}
        footer={<Pagination page={page} totalPages={pages} onPage={setPage} total={total} unit="transactions" />}
      />
    </div>
  );
}
