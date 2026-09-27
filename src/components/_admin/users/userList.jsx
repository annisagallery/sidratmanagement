'use client';
import { useRouter } from 'next-nprogress-bar';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Link from 'next/link';
import { MdToggleOn, MdToggleOff, MdOpenInNew, MdInbox, MdBlock, MdCheckCircle } from 'react-icons/md';
import * as api from 'src/services';
import { alertError, confirmAction, toastSuccess } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDate } from 'src/utils/formatTime';
import { RecordStatus } from 'src/components/_admin/ui/Badge';

const STATUS_OPTS = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Blocked', value: 'blocked' }
];

const fmt = (d) => (d ? fDate(d) : '—');

function Avatar({ name }) {
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-xs font-semibold"
      style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
    >
      {name?.slice(0, 2)?.toUpperCase() || '?'}
    </div>
  );
}

const StatusBadge = ({ status }) => <RecordStatus status={status} />;

/**
 * Customers page: storefront accounts only (no access role). Staff — and
 * turning a customer into staff — live in HRM → People.
 */
export default function UserList() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const limit = 20;

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const params = new URLSearchParams({
    page,
    limit,
    role: 'user',
    ...(search && { search }),
    ...(status && { status }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();

  const { data, isLoading, isFetching, isError, error: loadError, refetch } = useQuery(['admin-users', params], () => api.getUsersByAdmin(params), {
    keepPreviousData: true
  });

  const { mutate: updateStatus } = useMutation(api.updateUserStatusByAdmin, {
    onSuccess: () => {
      toastSuccess('Status updated');
      qc.invalidateQueries(['admin-users']);
    },
    onError: (error) => alertError(error, { title: "Couldn't change that status" })
  });

  const handleChangeStatus = async (user) => {
    const deactivating = user.status === 'active';
    const confirmed = await confirmAction({
      tone: deactivating ? 'warning' : 'success',
      title: deactivating ? 'Deactivate this customer?' : 'Reactivate this customer?',
      subject: `${user.name}${user.phone ? ` · ${user.phone}` : ''}`,
      text: deactivating
        ? 'They stay in the system and keep their order history, but cannot sign in or place orders.'
        : 'They can sign in and place orders again.',
      confirmText: deactivating ? 'Deactivate' : 'Reactivate'
    });
    if (confirmed) updateStatus(user.id);
  };

  // The endpoint toggles rather than sets, so a bulk run has to skip the rows
  // that are already where the operator wants them.
  const setAccountStatus = (target) => async (user) => {
    if (user.status === target) return;
    await api.updateUserStatusByAdmin(user.id);
  };

  const refreshUsers = () => qc.invalidateQueries(['admin-users']);

  const bulkActions = [
    {
      label: 'Deactivate',
      icon: MdBlock,
      tone: 'warning',
      action: 'Deactivated',
      unit: 'customers',
      hint: 'Block sign-in for the selected customers; already-inactive ones are skipped',
      confirm: (rows) =>
        confirmAction({
          tone: 'warning',
          title: `Deactivate ${rows.length} customer${rows.length === 1 ? '' : 's'}?`,
          text: 'They keep their order history but cannot sign in or place new orders.',
          items: rows.filter((user) => user.status === 'active').map((user) => `${user.name} · ${user.phone || user.email}`),
          confirmText: 'Deactivate'
        }),
      perform: setAccountStatus('blocked'),
      rowLabel: (user) => user.name || user.phone,
      onSettled: refreshUsers
    },
    {
      label: 'Reactivate',
      icon: MdCheckCircle,
      tone: 'success',
      action: 'Reactivated',
      unit: 'customers',
      confirm: (rows) =>
        confirmAction({
          tone: 'success',
          title: `Reactivate ${rows.length} customer${rows.length === 1 ? '' : 's'}?`,
          text: 'They can sign in and place orders again.',
          confirmText: 'Reactivate'
        }),
      perform: setAccountStatus('active'),
      rowLabel: (user) => user.name || user.phone,
      onSettled: refreshUsers
    }
  ];

  const users = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const columns = [
    {
      key: 'name',
      label: 'Customer',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-800">{u.name}</p>
            <p className="truncate text-xs text-slate-500">{u.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: true,
      render: (u) => <span className="text-slate-600">{u.phone || '—'}</span>
    },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: (u) => <span className="text-slate-600">{fmt(u.createdAt)}</span>
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      sortable: true,
      render: (u) => <span className="text-slate-600">{fmt(u.lastLogin)}</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (u) => <StatusBadge status={u.status} />
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end" onClick={stopRow}>
          <button type="button" onClick={() => handleChangeStatus(u)} className={u.status === 'active' ? 'btn-quiet btn-sm' : 'btn-ghost btn-sm'}>
            {u.status === 'active' ? 'Block' : 'Unblock'}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle={`${total} customer${total !== 1 ? 's' : ''} total`} />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search by name or email…"
        onReset={() => {
          setSearch('');
          setStatus('');
          setSortBy('');
          setPage(1);
        }}
      >
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[130px]"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        onRowClick={(u) => router.push(`/users/${encodeURIComponent(u.phone)}`)}
        rowLabel={(u) => `Open ${u.name}`}
        error={isError ? loadError : null}
        onRetry={refetch}
        columns={columns}
        data={users}
        sort={sort}
        selectionLabel="customers"
        exportFileName="customers-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading}
        isFetching={isFetching}
        empty={<EmptyState title="No customers found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="customers" />}
      />
    </div>
  );
}
