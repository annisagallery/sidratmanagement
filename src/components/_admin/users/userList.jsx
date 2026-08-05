'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Link from 'next/link';
import { MdToggleOn, MdToggleOff, MdOpenInNew, MdInbox, MdBadge, MdBlock, MdCheckCircle } from 'react-icons/md';
import * as api from 'src/services';
import { alertError, alertInfo, confirmAction, promptSelect, toastSuccess } from 'src/utils/swal';
import { usePermissions } from 'src/context/PermissionsContext';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDate } from 'src/utils/formatTime';

const STATUS_OPTS = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
];

const fmt = (d) => (d ? fDate(d) : '—');

function Avatar({ name }) {
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold"
      style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
    >
      {name?.slice(0, 2)?.toUpperCase() || '?'}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { active: 'bg-emerald-100 text-emerald-700', inactive: 'bg-red-100 text-red-700' };
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] || 'bg-slate-100 text-slate-600'}`}
    >
      {status}
    </span>
  );
}

/**
 * Customers page: storefront accounts only (role "user"). Staff live on the
 * Staff page. Promoting a customer assigns a real role from the role system —
 * the account then moves to the Staff list.
 */
export default function UserList() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const limit = 20;

  // Management is read/customer focused. Staff role assignment lives in HRM.
  const canPromote = false;

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

  const { data, isLoading, isFetching } = useQuery(['admin-users', params], () => api.getUsersByAdmin(params), {
    keepPreviousData: true
  });

  const { data: rolesData } = useQuery(['admin-roles'], api.getRolesByAdmin, {
    enabled: canPromote,
    staleTime: 5 * 60_000
  });
  // Staff roles a customer can be promoted into (never super admin, never customer)
  const staffRoles = (rolesData?.data || []).filter((r) => r.isActive && !['super-admin', 'user'].includes(r.slug));

  const { mutate: updateStatus } = useMutation(api.updateUserStatusByAdmin, {
    onSuccess: () => {
      toastSuccess('Status updated');
      qc.invalidateQueries(['admin-users']);
    },
    onError: (error) => alertError(error, { title: "Couldn't change that status" })
  });

  const { mutate: assignRole } = useMutation(({ slug, payload }) => api.assignRoleByAdmin(slug, payload), {
    onSuccess: (res) => {
      toastSuccess(res?.message || 'Role assigned');
      qc.invalidateQueries(['admin-users']);
      qc.invalidateQueries(['admin-admins']);
    },
    onError: (error) => alertError(error, { title: "Couldn't assign that role" })
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
      perform: setAccountStatus('inactive'),
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

  // Promote a customer to any staff role; branch-scoped roles ask for a branch.
  const handlePromote = async (row) => {
    if (!staffRoles.length) {
      return alertInfo('No roles available', 'Create a role under Users → Roles & Permissions first.');
    }

    const slug = await promptSelect({
      title: `Promote ${row.name}`,
      text: 'The account moves to the Staff list with the role you pick.',
      options: staffRoles.map((role) => ({ value: role.slug, label: role.name })),
      placeholder: 'Choose a role',
      confirmText: 'Next',
      requiredMessage: 'Pick a role to continue.'
    });
    if (!slug) return;

    const targetRole = staffRoles.find((role) => role.slug === slug);
    const payload = { userId: row.id };

    if (targetRole?.requiresBranch) {
      let branches = [];
      try {
        const res = await api.adminGetBranches();
        branches = (res?.data || []).filter((branch) => branch.isActive !== false);
      } catch (error) {
        return alertError(error, { title: "Couldn't load branches" });
      }
      if (!branches.length) return alertInfo('No branches yet', 'Create an active branch before assigning this role.');

      const branch = await promptSelect({
        title: 'Which branch?',
        text: `"${targetRole.name}" is branch-scoped — ${row.name} will only work within the branch you pick.`,
        options: branches.map((entry) => ({
          value: entry.id,
          label: `${entry.name}${entry.code ? ` (${entry.code})` : ''}`
        })),
        placeholder: 'Choose a branch',
        confirmText: 'Promote',
        requiredMessage: 'Pick a branch to continue.'
      });
      if (!branch) return;
      payload.branch = branch;
    }

    assignRole({ slug, payload });
  };

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
            <p className="truncate text-xs text-slate-400">{u.email}</p>
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
      label: 'Actions',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/users/${encodeURIComponent(u.phone)}`}
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="View Activity"
          >
            <MdOpenInNew size={17} />
          </Link>
          <button
            onClick={() => handleChangeStatus(u)}
            className="rounded-md p-2 transition hover:bg-slate-100"
            style={{ color: 'var(--brand-strong)' }}
            title="Toggle Status"
          >
            {u.status === 'active' ? <MdToggleOn size={19} /> : <MdToggleOff size={19} />}
          </button>
          {canPromote && (
            <button
              onClick={() => handlePromote(u)}
              className="rounded-md p-2 text-violet-400 transition hover:bg-violet-50"
              title="Promote to staff role"
            >
              <MdBadge size={17} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
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
        columns={columns}
        data={users}
        sort={sort}
        selectionLabel="customers"
        exportFileName="customers-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No customers found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="customers" />}
      />
    </div>
  );
}
