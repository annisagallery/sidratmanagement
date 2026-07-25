'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { MdClose, MdOutlineAccountBalanceWallet } from 'react-icons/md';

import * as api from 'src/services';
import { fCurrency } from 'src/utils/formatNumber';
import { fDateTime } from 'src/utils/formatTime';
import { usePermissions } from 'src/context/PermissionsContext';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import BranchSelect from './BranchSelect';

const ENTRY_LABELS = {
  SALE: 'Sale',
  SALE_CHANGE: 'Change returned',
  RETURN_REFUND: 'Return refund',
  EXCHANGE_SETTLEMENT: 'Exchange settlement',
  EXCHANGE_REFUND: 'Exchange refund',
  EXPENSE: 'Expense',
  EXPENSE_REVERSAL: 'Expense reversal',
  DEPOSIT_TO_HQ: 'Deposit to head office',
  ADJUSTMENT_IN: 'Cash in / adjustment',
  ADJUSTMENT_OUT: 'Adjustment out',
  OPENING: 'Opening balance'
};

const MANUAL_TYPES = [
  { value: 'ADJUSTMENT_IN', label: 'Adjustment in (add cash)' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment out (remove cash)' },
  { value: 'DEPOSIT_TO_HQ', label: 'Deposit to head office' },
  { value: 'OPENING', label: 'Opening balance' }
];

function ManualEntryForm({ branchId, onClose }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState('ADJUSTMENT_IN');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation(api.createBranchCashEntryByAdmin, {
    onSuccess: () => {
      toast.success('Entry recorded');
      queryClient.invalidateQueries(['admin-branch-cash-balance', branchId]);
      queryClient.invalidateQueries(['admin-branch-cash-entries', branchId]);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not save the entry')
  });

  const submit = () => {
    if (!(Number(amount) > 0)) return toast.error('Enter a valid amount');
    if (!note.trim()) return toast.error('A note is required for manual entries');
    mutation.mutate({ branchId, type, amount: Number(amount), note });
  };

  return (
    <div className="card-ui space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Manual cash entry</h3>
        <button className="btn-icon" onClick={onClose} aria-label="Close form">
          <MdClose size={16} />
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-500">
          Type
          <select className="select-ui mt-1 block" value={type} onChange={(e) => setType(e.target.value)}>
            {MANUAL_TYPES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-500">
          Amount
          <input type="number" min="0" step="0.01" className="input-ui mt-1 block w-40" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </label>
        <label className="flex-1 text-sm text-slate-500">
          Note (required)
          <input className="input-ui mt-1 w-full min-w-56" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this adjustment needed?" />
        </label>
        <button className="btn-brand h-10" disabled={mutation.isLoading} onClick={submit}>
          {mutation.isLoading ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </div>
  );
}

export default function BranchCash() {
  const { can } = usePermissions();
  const [branchId, setBranchId] = useState('');
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const limit = 20;

  const { data: balanceData } = useQuery(
    ['admin-branch-cash-balance', branchId],
    () => api.getBranchCashBalanceByAdmin(branchId),
    { enabled: Boolean(branchId), refetchInterval: 60_000 }
  );
  const balance = Number(balanceData?.data?.balance) || 0;

  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) query.set('type', type);
    return query.toString();
  }, [page, type]);

  const { data, isLoading } = useQuery(
    ['admin-branch-cash-entries', branchId, params],
    () => api.getBranchCashEntriesByAdmin(branchId, params),
    { enabled: Boolean(branchId), keepPreviousData: true }
  );
  const entries = data?.data || [];

  const columns = [
    { key: 'date', label: 'Date', render: (row) => fDateTime(row.createdAt) },
    { key: 'type', label: 'Entry', render: (row) => ENTRY_LABELS[row.type] || row.type },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => (
        <b className={row.amount < 0 ? 'text-red-500' : 'text-emerald-600'}>
          {row.amount < 0 ? '−' : '+'}{fCurrency(Math.abs(row.amount))}
        </b>
      )
    },
    { key: 'balanceAfter', label: 'Balance', align: 'right', render: (row) => fCurrency(row.balanceAfter) },
    { key: 'note', label: 'Note', render: (row) => <span className="text-slate-500">{row.note || '—'}</span> },
    { key: 'by', label: 'By', render: (row) => row.performedBy?.name || '—' }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Branch Cash" subtitle="Live drawer balance and full cash ledger per branch" icon={MdOutlineAccountBalanceWallet}>
        <BranchSelect value={branchId} onChange={(value) => { setBranchId(value); setPage(1); setShowForm(false); }} />
        {branchId && can('adjust', 'BranchCash') && (
          <button className="btn-brand h-10" onClick={() => setShowForm((v) => !v)}>Manual entry</button>
        )}
      </PageHeader>

      {!branchId ? (
        <div className="card-ui p-10 text-center text-sm text-slate-400">Select a branch to view its cash drawer.</div>
      ) : (
        <>
          <div className={`card-ui p-5 ${balance < 0 ? 'ring-1 ring-red-200' : ''}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Current cash in drawer</p>
            <p className={`mt-1 text-3xl font-bold ${balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>{fCurrency(balance)}</p>
            {balance < 0 && <p className="mt-1 text-xs font-semibold text-red-500">Negative drawer — reconcile with an adjustment entry.</p>}
          </div>

          {showForm && <ManualEntryForm branchId={branchId} onClose={() => setShowForm(false)} />}

          <div className="flex justify-end">
            <select className="select-ui" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All entries</option>
              {Object.entries(ENTRY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <DataTable
            columns={columns}
            data={entries}
            isLoading={isLoading}
            footer={<Pagination page={page} totalPages={data?.count || 0} onPage={setPage} total={data?.total} unit="entries" pageSize={limit} />}
          />
        </>
      )}
    </div>
  );
}
