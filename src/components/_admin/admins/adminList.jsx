'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { MdToggleOn, MdToggleOff, MdInbox, MdBlock, MdCheckCircle, MdBadge } from 'react-icons/md';
import * as api from 'src/services';
import { alertError, alertInfo, confirmAction, promptSelect, toastSuccess } from 'src/utils/swal';
import { usePermissions } from 'src/context/PermissionsContext';
import { fDate } from 'src/utils/formatTime';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { isSuperAdmin } from 'src/utils/adminRole';

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

// legacy enum → seeded role slug (for users not yet assigned a roleSlug)
const USER_ROLE_SLUGS = {
  super_admin: 'super-admin',
  admin: 'admin',
  salesman: 'salesman',
  user: 'user'
};

export default function AdminList() {
  const qc = useQueryClient();
  const { can } = usePermissions();
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
    ...(search && { search }),
    ...(status && { status }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();

  const { data, isLoading, isFetching } = useQuery(['admin-admins', params], () => api.getAdminsByAdmin(params), {
    keepPreviousData: true
  });

  const canAssignRoles = can('update', 'Admin');
  const { data: rolesData } = useQuery(['admin-roles'], api.getRolesByAdmin, {
    enabled: canAssignRoles,
    staleTime: 5 * 60_000
  });
  const roles = (rolesData?.data || []).filter((r) => r.isActive);
  // Branch-scoped roles need a branch chosen per person, so they stay out of the
  // bulk picker; super-admin is never handed out in a batch.
  const bulkRoles = roles.filter((role) => !role.requiresBranch && role.slug !== 'super-admin');
  let pendingRoleSlug = null;

  const { mutate: assignRole } = useMutation(
    ({ slug, userId, branch }) => api.assignRoleByAdmin(slug, { userId, ...(branch ? { branch } : {}) }),
    {
      onSuccess: (res) => {
        toastSuccess(res?.message || 'Role updated');
        qc.invalidateQueries(['admin-admins']);
        qc.invalidateQueries(['admin-users']);
      },
      onError: (error) => {
        alertError(error, { title: "Couldn't update that role" });
        qc.invalidateQueries(['admin-admins']);
      }
    }
  );

  const { mutate: updateStatus } = useMutation(api.updateUserStatusByAdmin, {
    onSuccess: () => {
      toastSuccess('Status updated');
      qc.invalidateQueries(['admin-admins']);
    },
    onError: (error) => alertError(error, { title: "Couldn't change that status" })
  });

  const handleChangeStatus = async (staff) => {
    const suspending = staff.status === 'active';
    const confirmed = await confirmAction({
      tone: suspending ? 'warning' : 'success',
      title: suspending ? 'Suspend this staff account?' : 'Restore this staff account?',
      subject: `${staff.name}${staff.email ? ` · ${staff.email}` : ''}`,
      text: suspending
        ? 'They are signed out of every panel and cannot sign back in until restored.'
        : 'They can sign in again with the permissions their role grants.',
      confirmText: suspending ? 'Suspend' : 'Restore'
    });
    if (confirmed) updateStatus(staff.id);
  };

  // The endpoint toggles rather than sets, so skip rows already in the target state.
  const setAccountStatus = (target) => async (staff) => {
    if (staff.status === target) return;
    await api.updateUserStatusByAdmin(staff.id);
  };

  const refreshAdmins = () => qc.invalidateQueries(['admin-admins']);

  const bulkActions = [
    {
      label: 'Suspend',
      icon: MdBlock,
      tone: 'warning',
      action: 'Suspended',
      unit: 'staff accounts',
      hint: 'Sign these accounts out of every panel and block sign-in',
      confirm: (rows) =>
        confirmAction({
          tone: 'warning',
          title: `Suspend ${rows.length} staff account${rows.length === 1 ? '' : 's'}?`,
          text: 'They lose access to every panel immediately. Their records and history stay intact.',
          items: rows.filter((staff) => staff.status === 'active').map((staff) => `${staff.name} · ${staff.role || 'staff'}`),
          confirmText: 'Suspend'
        }),
      perform: setAccountStatus('inactive'),
      rowLabel: (staff) => staff.name || staff.email,
      onSettled: refreshAdmins
    },
    {
      label: 'Restore',
      icon: MdCheckCircle,
      tone: 'success',
      action: 'Restored',
      unit: 'staff accounts',
      confirm: (rows) =>
        confirmAction({
          tone: 'success',
          title: `Restore ${rows.length} staff account${rows.length === 1 ? '' : 's'}?`,
          text: 'They can sign in again with the permissions their role grants.',
          confirmText: 'Restore'
        }),
      perform: setAccountStatus('active'),
      rowLabel: (staff) => staff.name || staff.email,
      onSettled: refreshAdmins
    },
    {
      label: 'Assign role',
      icon: MdBadge,
      tone: 'neutral',
      action: 'Reassigned',
      unit: 'staff accounts',
      hint: 'Give every selected account the same role',
      disabled: () => !canAssignRoles || bulkRoles.length === 0,
      confirm: async (rows) => {
        pendingRoleSlug = await promptSelect({
          title: `Assign a role to ${rows.length} account${rows.length === 1 ? '' : 's'}`,
          text: 'Branch-scoped roles are skipped here — assign those one at a time so each gets the right branch.',
          options: bulkRoles.map((role) => ({ value: role.slug, label: role.name })),
          placeholder: 'Choose a role',
          confirmText: 'Assign'
        });
        return Boolean(pendingRoleSlug);
      },
      perform: async (staff) => {
        if (staff.roleSlug === pendingRoleSlug) return;
        await api.assignRoleByAdmin(pendingRoleSlug, { userId: staff.id });
      },
      rowLabel: (staff) => staff.name || staff.email,
      onSettled: () => {
        refreshAdmins();
        qc.invalidateQueries(['admin-users']);
      }
    }
  ];

  // Assign a role from the row's dropdown; branch-scoped roles need a branch,
  // and choosing "Customer" demotes the account back to the Customers list.
  const handleAssign = async (u, slug, currentSlug) => {
    const targetRole = roles.find((r) => r.slug === slug);
    const payload = { userId: u.id };

    if (targetRole?.requiresBranch && !u.branch) {
      let branches = [];
      try {
        const res = await api.adminGetBranches();
        branches = (res?.data || []).filter((b) => b.isActive !== false);
      } catch (error) {
        return alertError(error, { title: "Couldn't load branches" });
      }
      if (!branches.length) return alertInfo('No branches yet', 'Create an active branch before assigning this role.');

      const branch = await promptSelect({
        title: 'Which branch?',
        text: `"${targetRole.name}" is branch-scoped — ${u.name} will only work within the branch you pick.`,
        options: branches.map((entry) => ({
          value: entry.id,
          label: `${entry.name}${entry.code ? ` (${entry.code})` : ''}`
        })),
        placeholder: 'Choose a branch',
        confirmText: 'Assign',
        requiredMessage: 'Pick a branch to continue.'
      });
      if (!branch) return qc.invalidateQueries(['admin-admins']);
      payload.branch = branch;
    }

    if (slug === 'user') {
      const confirmed = await confirmAction({
        tone: 'warning',
        title: `Demote ${u.name}?`,
        text: 'They become a normal customer and lose access to every staff panel.',
        confirmText: 'Demote'
      });
      if (!confirmed) return qc.invalidateQueries(['admin-admins']);
    }

    if (slug !== currentSlug) assignRole({ slug, userId: payload.userId, branch: payload.branch });
  };

  const admins = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const columns = [
    {
      key: 'name',
      label: 'Admin',
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
      key: 'role',
      label: 'Role',
      render: (u) => {
        const currentSlug = u.roleSlug || USER_ROLE_SLUGS[u.role] || 'admin';
        if (!canAssignRoles || isSuperAdmin(u)) {
          const current = roles.find((r) => r.slug === currentSlug);
          return <span className="text-slate-600 capitalize">{current?.name || u.role}</span>;
        }
        return (
          <select
            className="select-ui !h-8 min-w-[130px] text-xs"
            value={currentSlug}
            onChange={(e) => {
              if (e.target.value !== currentSlug) handleAssign(u, e.target.value, currentSlug);
            }}
          >
            {roles
              .filter((r) => r.slug !== 'super-admin')
              .map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
          </select>
        );
      }
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
          <button
            onClick={() => handleChangeStatus(u)}
            className="rounded-md p-2 transition hover:bg-slate-100"
            style={{ color: 'var(--brand-strong)' }}
            title="Toggle Status"
          >
            {u.status === 'active' ? <MdToggleOn size={19} /> : <MdToggleOff size={19} />}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        subtitle={`${total} staff account${total !== 1 ? 's' : ''} — assign roles from the dropdown`}
      />

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
        data={admins}
        sort={sort}
        selectionLabel="staff accounts"
        exportFileName="staff-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No admins found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="admins" />}
      />
    </div>
  );
}
