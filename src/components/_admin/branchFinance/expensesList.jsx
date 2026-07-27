'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { MdClose, MdOutlineReceipt } from 'react-icons/md';

import * as api from 'src/services';
import { fCurrency } from 'src/utils/formatNumber';
import { usePermissions } from 'src/context/PermissionsContext';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable from 'src/components/_admin/ui/DataTable';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import Pagination from 'src/components/_admin/ui/Pagination';
import BranchSelect from './BranchSelect';
import PrivateExpenseImage from './PrivateExpenseImage';
import { fDate, fDateTime } from 'src/utils/formatTime';

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50 text-red-600 ring-red-200'
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}
    >
      {status}
    </span>
  );
}

function ExpensePanel({ expenseId, onClose }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [reviewNote, setReviewNote] = useState('');

  const { data } = useQuery(['admin-expense', expenseId], () => api.getExpenseByAdmin(expenseId));
  const expense = data?.data;

  const reviewMutation = useMutation(api.reviewExpenseByAdmin, {
    onSuccess: (_res, variables) => {
      toast.success(`Expense ${variables.decision}`);
      queryClient.invalidateQueries(['admin-expenses']);
      queryClient.invalidateQueries(['admin-expense', expenseId]);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Review failed')
  });

  const review = (decision) => {
    if (decision === 'rejected' && !reviewNote.trim()) {
      return toast.error('Add a note explaining the rejection');
    }
    reviewMutation.mutate({ id: expenseId, decision, reviewNote });
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">
            {expense?.expenseNo || 'Expense'} {expense && <StatusBadge status={expense.status} />}
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close panel">
            <MdClose size={18} />
          </button>
        </div>

        {!expense ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p>
                <span className="text-slate-400">Branch:</span> {expense.branch?.name}
              </p>
              <p>
                <span className="text-slate-400">Type:</span> {expense.typeName}
              </p>
              <p>
                <span className="text-slate-400">Amount:</span> <b>{fCurrency(expense.amount)}</b>
              </p>
              <p>
                <span className="text-slate-400">Paid via:</span>{' '}
                {expense.paidVia === 'cash' ? 'Cash (drawer)' : expense.paymentLabel || 'Other'}
              </p>
              <p>
                <span className="text-slate-400">By:</span> {expense.createdBy?.name}
              </p>
              <p>
                <span className="text-slate-400">Date:</span> {fDateTime(expense.createdAt)}
              </p>
            </div>

            {expense.description && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Description</p>
                <p className="mt-1 text-sm text-slate-700">{expense.description}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Proof images</p>
              {(expense.proofImages || []).length === 0 ? (
                <p className="mt-1 text-sm text-slate-400">No proof attached.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {expense.proofImages.map((image) => (
                    <PrivateExpenseImage
                      key={image.id}
                      expenseId={expense.id}
                      imageId={image.id}
                      alt="Expense proof"
                      className="relative block h-28 w-28 overflow-hidden rounded-md border border-slate-200"
                    />
                  ))}
                </div>
              )}
            </div>

            {expense.paidVia === 'cash' && (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                This cash expense was deducted from the branch drawer when it was recorded. Rejecting it posts a
                reversal entry returning the amount to the drawer.
              </p>
            )}

            {expense.status === 'pending' && can('review', 'BranchExpense') ? (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <label className="block text-sm text-slate-500">
                  Review note
                  <textarea
                    rows={2}
                    className="input-ui mt-1 w-full !h-auto py-2"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Optional for approval, required for rejection"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    className="btn-brand h-10 flex-1"
                    disabled={reviewMutation.isLoading}
                    onClick={() => review('approved')}
                  >
                    Approve
                  </button>
                  <button
                    className="h-10 flex-1 rounded-md bg-red-50 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-100 disabled:opacity-50"
                    disabled={reviewMutation.isLoading}
                    onClick={() => review('rejected')}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : expense.status !== 'pending' ? (
              <div className="border-t border-slate-100 pt-4 text-sm">
                <p>
                  <span className="text-slate-400">Reviewed by:</span> {expense.reviewedBy?.name || '—'}
                  {expense.reviewedAt && (
                    <span className="text-slate-400"> · {fDateTime(expense.reviewedAt)}</span>
                  )}
                </p>
                {expense.reviewNote && <p className="mt-1 text-slate-600">{expense.reviewNote}</p>}
              </div>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

export default function ExpensesList() {
  const [page, setPage] = useState(1);
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const limit = 20;

  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (branch) query.set('branch', branch);
    if (status) query.set('status', status);
    if (search.trim()) query.set('search', search.trim());
    return query.toString();
  }, [page, branch, status, search]);

  const { data, isLoading } = useQuery(['admin-expenses', params], () => api.getExpensesByAdmin(params), {
    keepPreviousData: true
  });
  const expenses = data?.data || [];

  const columns = [
    { key: 'expenseNo', label: 'No', render: (row) => <span className="font-semibold">{row.expenseNo}</span> },
    { key: 'branch', label: 'Branch', render: (row) => row.branch?.name || '—' },
    { key: 'type', label: 'Type', render: (row) => row.typeName },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => <b>{fCurrency(row.amount)}</b> },
    {
      key: 'paidVia',
      label: 'Paid via',
      render: (row) => (row.paidVia === 'cash' ? 'Cash' : row.paymentLabel || 'Other')
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'by', label: 'By', render: (row) => row.createdBy?.name || '—' },
    { key: 'date', label: 'Date', render: (row) => fDate(row.createdAt) },
    {
      key: 'proof',
      label: 'Proof',
      align: 'center',
      render: (row) => (row.proofImages?.length ? row.proofImages.length : '—')
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Branch Expenses"
        subtitle="Review what branches spend — approve or reject with a note"
        icon={MdOutlineReceipt}
      />

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search expense no…"
        onReset={() => {
          setBranch('');
          setStatus('');
          setSearch('');
          setPage(1);
        }}
      >
        <BranchSelect
          value={branch}
          onChange={(value) => {
            setBranch(value);
            setPage(1);
          }}
          allowAll
        />
        <select
          className="select-ui"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </ListToolbar>

      <DataTable
        columns={columns}
        data={expenses}
        isLoading={isLoading}
        onRowClick={(row) => setSelectedId(row.id)}
        footer={
          <Pagination
            page={page}
            totalPages={data?.count || 0}
            onPage={setPage}
            total={data?.total}
            unit="expenses"
            pageSize={limit}
          />
        }
      />

      {selectedId && <ExpensePanel expenseId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
