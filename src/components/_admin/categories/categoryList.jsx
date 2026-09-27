'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import Image from 'next/image';
import { MdAdd, MdDelete, MdEdit, MdInbox, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import * as api from 'src/services';
import { alertError, confirmAction, confirmDelete } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Badge from 'src/components/_admin/ui/Badge';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDate } from 'src/utils/formatTime';
import { RecordStatus } from 'src/components/_admin/ui/Badge';

const STATUS_OPTS = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
];

const StatusBadge = ({ status }) => <RecordStatus status={status} />;

export default function CategoryList() {
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
    ...(search && { search }),
    ...(status && { status }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();

  const { data, isLoading, isFetching, isError, error: loadError, refetch } = useQuery(
    ['admin-categories', params],
    () => api.getCategoriesByAdmin(params),
    {
      keepPreviousData: true,
      onError: (error) => alertError(error, { title: "Couldn't load categories" })
    }
  );

  const refreshCategories = () => qc.invalidateQueries(['admin-categories']);

  const applyToCategory = (payload) => (category) =>
    api.updateCategoryByAdmin({ currentSlug: category.slug, ...payload });

  const bulkActions = [
    {
      label: 'Show in shop',
      icon: MdVisibility,
      tone: 'success',
      action: 'Published',
      unit: 'categories',
      disabled: (rows) => rows.some((category) => category.isSystem),
      hint: 'System categories keep their fixed visibility.',
      confirm: (rows) =>
        confirmAction({
          tone: 'success',
          title: `Show ${rows.length} categor${rows.length === 1 ? 'y' : 'ies'} in the shop?`,
          text: 'They become browsable on the storefront and appear in navigation.',
          confirmText: 'Show'
        }),
      perform: applyToCategory({ status: 'active', isVisibleInEcom: true }),
      onSettled: refreshCategories
    },
    {
      label: 'Hide from shop',
      icon: MdVisibilityOff,
      tone: 'warning',
      action: 'Hidden',
      unit: 'categories',
      disabled: (rows) => rows.some((category) => category.isSystem),
      hint: 'System categories keep their fixed visibility.',
      confirm: (rows) =>
        confirmAction({
          tone: 'warning',
          title: `Hide ${rows.length} categor${rows.length === 1 ? 'y' : 'ies'}?`,
          text: 'Shoppers stop seeing them. Products inside keep their own status.',
          confirmText: 'Hide'
        }),
      perform: applyToCategory({ isVisibleInEcom: false }),
      onSettled: refreshCategories
    },
    {
      label: 'Delete',
      icon: MdDelete,
      tone: 'danger',
      action: 'Deleted',
      unit: 'categories',
      disabled: (rows) => rows.some((category) => category.isSystem),
      hint: 'Permanent system categories cannot be deleted.',
      confirm: (rows) =>
        confirmDelete({
          count: rows.length,
          unit: 'categories',
          subject: rows.length === 1 ? rows[0].name : undefined,
          items: rows.map((category) => category.name),
          text: 'Products keep existing but lose this category and drop out of its listings.'
        }),
      perform: (category) => api.deleteCategoryByAdmin(category.slug),
      rowLabel: (category) => category.name,
      onSettled: refreshCategories
    }
  ];

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
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-400">
                {c.name?.[0]}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900">{c.name}</p>
            {c.isSystem && (
              <Badge className="mt-1">
                <MdLock size={12} aria-hidden="true" /> Permanent POS category
              </Badge>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'slug',
      label: 'Slug',
      sortable: true,
      hideBelow: 'lg',
      render: (c) => <span className="font-mono text-xs text-slate-500">{c.slug}</span>
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      hideBelow: 'xl',
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
      render: (c) => <StatusBadge status={c.status} />
    },
    {
      key: 'isVisibleInEcom',
      label: 'On the storefront',
      sortable: true,
      hideBelow: 'md',
      render: (c) =>
        c.isVisibleInEcom !== false ? (
          <Badge tone="success">
            <MdVisibility size={14} aria-hidden /> Visible
          </Badge>
        ) : (
          <Badge>
            <MdVisibilityOff size={14} aria-hidden /> Hidden
          </Badge>
        )
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (c) => (
        <button type="button" onClick={(event) => { stopRow(event); router.push(`/categories/${c.slug}`); }} className="btn-ghost btn-sm">
          Edit
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" subtitle={`${total} categor${total !== 1 ? 'ies' : 'y'} total`}>
        <button type="button" onClick={() => router.push('/categories/add')} className="btn-brand">
          <MdAdd size={18} /> Add category
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
          aria-label="Status"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        error={isError ? loadError : null}
        onRetry={refetch}
        columns={columns}
        data={categories}
        sort={sort}
        rowKey={(category) => category.slug}
        caption="Categories"
        onRowClick={(c) => router.push(`/categories/${c.slug}`)}
        rowLabel={(c) => `Edit ${c.name}`}
        selectionLabel="categories"
        exportFileName="categories-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading}
        isFetching={isFetching}
        empty={
          <EmptyState
            title={search || status ? 'No categories match these filters' : 'No categories yet'}
            icon={MdInbox}
            action={
              search || status ? null : (
                <button type="button" onClick={() => router.push('/categories/add')} className="btn-brand">
                  <MdAdd size={18} aria-hidden /> Add category
                </button>
              )
            }
          />
        }
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="categories" />}
      />
    </div>
  );
}
