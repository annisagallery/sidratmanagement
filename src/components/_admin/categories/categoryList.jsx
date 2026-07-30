'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import Swal from 'sweetalert2';
import Image from 'next/image';
import { MdAdd, MdEdit, MdInbox, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import * as api from 'src/services';
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

export default function CategoryList() {
  const router = useRouter();
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

  const { data, isLoading, isFetching } = useQuery(
    ['admin-categories', params],
    () => api.getCategoriesByAdmin(params),
    {
      keepPreviousData: true,
      onError: (err) => Swal.fire(err?.response?.data?.message || 'Error', '', 'error')
    }
  );

  const categories = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const columns = [
    {
      key: 'name',
      label: 'Category',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {c.image?.path ? (
              <Image src={c.image.path} alt={c.name} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-slate-300">
                {c.name?.[0]}
              </div>
            )}
          </div>
          <p className="text-[13px] font-semibold text-slate-800">{c.name}</p>
        </div>
      )
    },
    {
      key: 'slug',
      label: 'Slug',
      sortable: true,
      render: (c) => <span className="font-mono text-xs text-slate-400">{c.slug}</span>
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (c) => (
        <span className="text-xs text-slate-500">
          {c.createdAt ? fDate(c.createdAt) : '—'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (c) => <StatusBadge status={c.status} />
    },
    {
      key: 'isVisibleInEcom',
      label: 'Ecommerce',
      sortable: true,
      align: 'center',
      render: (c) => (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
            c.isVisibleInEcom !== false
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {c.isVisibleInEcom !== false ? <MdVisibility size={14} /> : <MdVisibilityOff size={14} />}
          {c.isVisibleInEcom !== false ? 'Visible' : 'Hidden'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (c) => (
        <button
          onClick={() => router.push(`/categories/${c.slug}`)}
          className="rounded-md p-2 transition hover:bg-slate-100"
          style={{ color: 'var(--brand-strong)' }}
          title="Edit"
        >
          <MdEdit size={17} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Categories" subtitle={`${total} categor${total !== 1 ? 'ies' : 'y'} total`}>
        <button onClick={() => router.push('/categories/add')} className="btn-brand">
          <MdAdd size={18} /> Add Category
        </button>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search by name…"
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
          className="select-ui min-w-[140px]"
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
        data={categories}
        sort={sort}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No categories found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="categories" />}
      />
    </div>
  );
}
