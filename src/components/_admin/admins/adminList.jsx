'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import { MdToggleOn, MdToggleOff, MdInbox } from 'react-icons/md';
import * as api from 'src/services';
import { usePermissions } from 'src/context/PermissionsContext';
import { fDate } from 'src/utils/formatTime';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';

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
const LEGACY_SLUGS = { 'super admin': 'super-admin', admin: 'admin', salesman: 'salesman', user: 'user' };

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

  const { mutate: assignRole } = useMutation(
    ({ slug, userId, branch }) => api.assignRoleByAdmin(slug, { userId, ...(branch ? { branch } : {}) }),
    {
      onSuccess: (res) => {
        Swal.fire({ title: res?.message || 'Role updated!', icon: 'success', timer: 1400, showConfirmButton: false });
        qc.invalidateQueries(['admin-admins']);
        qc.invalidateQueries(['admin-users']);
      },
      onError: (err) => {
        Swal.fire('Error', err?.response?.data?.message || 'Failed', 'error');
        qc.invalidateQueries(['admin-admins']);
      }
    }
  );

  const { mutate: updateStatus } = useMutation(api.updateUserStatusByAdmin, {
    onSuccess: () => {
      Swal.fire({ title: 'Status updated!', icon: 'success', timer: 1200, showConfirmButton: false });
      qc.invalidateQueries(['admin-admins']);
    },
    onError: (err) => Swal.fire('Error', err?.response?.data?.message || 'Failed', 'error')
  });

  const handleChangeStatus = async (userId) => {
    const r = await Swal.fire({
      title: 'Change Status',
      text: "Change this admin's status?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, change it!'
    });
    if (r.isConfirmed) updateStatus(userId);
  };

  // Assign a role from the row's dropdown; branch-scoped roles need a branch,
  // and choosing "Customer" demotes the account back to the Customers list.
  const handleAssign = async (u, slug, currentSlug) => {
    const targetRole = roles.find((r) => r.slug === slug);
    const payload = { userId: u._id };

    if (targetRole?.requiresBranch && !u.branch) {
      let branches = [];
      try {
        const res = await api.adminGetBranches();
        branches = (res?.data || []).filter((b) => b.isActive !== false);
      } catch {
        return Swal.fire('Error', 'Could not load branches.', 'error');
      }
      if (!branches.length) return Swal.fire('No branches', 'Create an active branch first.', 'info');
      const options = Object.fromEntries(branches.map((b) => [b._id, `${b.name}${b.code ? ` (${b.code})` : ''}`]));
      const { isConfirmed, value: branch } = await Swal.fire({
        title: 'Select branch',
        text: `"${targetRole.name}" is branch-scoped — ${u.name} will only work within this branch.`,
        input: 'select',
        inputOptions: options,
        inputPlaceholder: 'Select branch',
        showCancelButton: true,
        confirmButtonText: 'Assign',
        preConfirm: (v) => {
          if (!v) Swal.showValidationMessage('Select a branch.');
          return v;
        }
      });
      if (!isConfirmed || !branch) return qc.invalidateQueries(['admin-admins']);
      payload.branch = branch;
    }

    if (slug === 'user') {
      const r = await Swal.fire({
        title: `Demote ${u.name}?`,
        text: 'They become a normal customer and lose all staff access.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Demote'
      });
      if (!r.isConfirmed) return qc.invalidateQueries(['admin-admins']);
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
        const currentSlug = u.roleSlug || LEGACY_SLUGS[u.role] || 'admin';
        if (!canAssignRoles || u.role === 'super admin') {
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
            onClick={() => handleChangeStatus(u._id)}
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
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No admins found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="admins" />}
      />
    </div>
  );
}
