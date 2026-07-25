'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Link from 'next/link';
import { getUserCashList } from 'src/services';
import { MdAdd, MdPeople, MdOpenInNew } from 'react-icons/md';
import CashModal from './_CashModal';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';

const BDT = '৳';

export default function CashList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [modalUser, setModalUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery(
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

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold"
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
            <p className="text-xs text-slate-400">{u.email}</p>
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
        <span className={`font-bold tabular-nums ${(u.cash || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
          {BDT}
          {(u.cash || 0).toLocaleString()}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openModal(u)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50"
            style={{ color: 'var(--brand-strong)', borderColor: 'var(--brand-ring)' }}
          >
            <MdAdd size={13} /> Give Cashback
          </button>
          <Link
            href={`/users/${encodeURIComponent(u.phone)}`}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="View Activity"
          >
            <MdOpenInNew size={15} />
          </Link>
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
          <button onClick={() => openModal(null)} className="btn-brand">
            <MdAdd size={18} /> Give Cashback
          </button>
        }
      />

      <p className="text-xs text-slate-400">
        {isFetching && !isLoading ? 'Refreshing…' : `${total.toLocaleString()} user${total !== 1 ? 's' : ''}`}
        {activeSearch && (
          <span>
            {' '}
            matching "<strong>{activeSearch}</strong>"
          </span>
        )}
      </p>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        empty={<EmptyState title="No users found" icon={MdPeople} />}
        footer={<Pagination page={page} totalPages={pages} onPage={setPage} total={total} unit="users" />}
      />
    </div>
  );
}
