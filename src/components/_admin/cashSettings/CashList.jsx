'use client';
import { useRouter } from 'next-nprogress-bar';
import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Link from 'next/link';
import { adminAdjustCash, getUserCashList } from 'src/services';
import { MdAdd, MdPeople, MdOpenInNew, MdAddCircle, MdRemoveCircle } from 'react-icons/md';
import { alertWarning, promptText } from 'src/utils/swal';
import CashModal from './_CashModal';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';

const BDT = '৳';

export default function CashList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [modalUser, setModalUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isFetching, isError, error: loadError, refetch } = useQuery(
    ['cash-user-list', page, activeSearch],
    () => getUserCashList(page, activeSearch),
    {
      keepPreviousData: true
    }
  );

  const users = data?.data || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const openModal = (user = null) => {
    setModalUser(user);
    setShowModal(true);
  };

  const onDone = () => {
    qc.invalidateQueries('cash-user-list');
    qc.invalidateQueries('cash-transactions');
  };

  // Amount and reason are collected once and applied to every selected account —
  // each adjustment still lands as its own ledger entry carrying that reason.
  let pendingAdjustment = null;

  const collectAdjustment = (type) => async (rows) => {
    const amount = await promptText({
      tone: type === 'manual_credit' ? 'success' : 'warning',
      title: `${type === 'manual_credit' ? 'Give' : 'Take back'} coins from ${rows.length} customer${rows.length === 1 ? '' : 's'}`,
      text: 'The same amount is applied to each account. A debit never pushes a balance below zero.',
      label: 'Amount per customer',
      placeholder: 'e.g. 100',
      multiline: false,
      confirmText: 'Next',
      requiredMessage: 'Enter how many coins to apply.'
    });
    if (!amount) return false;

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      await alertWarning('That amount is not usable', 'Enter a positive number of coins.');
      return false;
    }

    const reason = await promptText({
      tone: type === 'manual_credit' ? 'success' : 'warning',
      title: 'Why this adjustment?',
      text: `${value} coin${value === 1 ? '' : 's'} ${type === 'manual_credit' ? 'to' : 'from'} each of ${rows.length} customer${rows.length === 1 ? '' : 's'}. The reason shows on their coin history.`,
      label: 'Reason',
      placeholder: 'e.g. goodwill for the delayed Eid batch',
      confirmText: type === 'manual_credit' ? 'Give coins' : 'Take coins',
      requiredMessage: 'Customers see this reason — say what it is for.'
    });
    if (!reason) return false;

    pendingAdjustment = { amount: value, type, message: reason };
    return true;
  };

  const applyAdjustment = (user) =>
    adminAdjustCash({ userId: user.id, ...pendingAdjustment });

  const bulkActions = [
    {
      label: 'Give coins',
      icon: MdAddCircle,
      tone: 'success',
      action: 'Credited',
      unit: 'customers',
      confirm: collectAdjustment('manual_credit'),
      perform: applyAdjustment,
      rowLabel: (user) => user.name || user.phone || user.email,
      onSettled: onDone
    },
    {
      label: 'Take coins',
      icon: MdRemoveCircle,
      tone: 'warning',
      action: 'Debited',
      unit: 'customers',
      confirm: collectAdjustment('manual_debit'),
      perform: applyAdjustment,
      rowLabel: (user) => user.name || user.phone || user.email,
      onSettled: onDone
    }
  ];

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-xs font-semibold"
            style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
          >
            {u.name?.slice(0, 2)?.toUpperCase() || '?'}
          </div>
          <div>
            <Link
              href={`/users/${encodeURIComponent(u.phone)}`}
              className="text-[13px] font-semibold text-slate-800 hover:underline"
            >
              {u.name || '—'}
            </Link>
            <p className="text-xs text-slate-500">{u.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (u) => (
        <Link href={`/users/${encodeURIComponent(u.phone)}`} className="text-slate-600 hover:underline">
          {u.phone}
        </Link>
      )
    },
    {
      key: 'cash',
      label: 'Cashback Balance',
      align: 'right',
      render: (u) => (
        <span className={`font-semibold tabular-nums ${(u.cash || 0) > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
          {BDT}
          {(u.cash || 0).toLocaleString()}
        </span>
      )
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end" onClick={stopRow}>
          <button type="button" onClick={() => openModal(u)} className="btn-ghost btn-sm">
            <MdAdd size={15} aria-hidden /> Adjust cashback
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {showModal && (
        <CashModal
          prefilledUser={modalUser}
          onClose={() => {
            setShowModal(false);
            setModalUser(null);
          }}
          onDone={onDone}
        />
      )}

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => {
          setPage(1);
          setActiveSearch(search);
        }}
        searchPlaceholder="Search by name, phone, or email…"
        right={
          <button type="button" onClick={() => openModal(null)} className="btn-brand">
            <MdAdd size={18} /> Give cashback
          </button>
        }
      />

      <p className="text-xs text-slate-500">
        {isFetching && !isLoading ? 'Refreshing…' : `${total.toLocaleString()} user${total !== 1 ? 's' : ''}`}
        {activeSearch && (
          <span>
            {' '}
            matching "<strong>{activeSearch}</strong>"
          </span>
        )}
      </p>

      <DataTable
        onRowClick={(u) => router.push(`/users/${encodeURIComponent(u.phone)}`)}
        rowLabel={(u) => `Open ${u.name}`}
        error={isError ? loadError : null}
        onRetry={refetch}
        columns={columns}
        data={users}
        selectionLabel="customers"
        exportFileName="coin-balances-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading}
        empty={<EmptyState title="No users found" icon={MdPeople} />}
        footer={<Pagination page={page} totalPages={pages} onPage={setPage} total={total} unit="users" />}
      />
    </div>
  );
}
