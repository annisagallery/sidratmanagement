'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import Link from 'next/link';
import Image from 'next/image';
import { MdAdd, MdEdit, MdDelete, MdInbox } from 'react-icons/md';
import { FiZap, FiTag, FiSun, FiVolume2 } from 'react-icons/fi';
import { getCampaignsByAdmin, deleteCampaignByAdmin } from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDate } from 'src/utils/formatTime';

const TYPE_OPTS = [
  { label: 'All Types', value: '' },
  { label: 'Flash Sale', value: 'flash_sale' },
  { label: 'Discount', value: 'discount' },
  { label: 'Seasonal', value: 'seasonal' },
  { label: 'Announcement', value: 'announcement' }
];

const TYPE_META = {
  flash_sale: { label: 'Flash Sale', icon: <FiZap size={11} />, cls: 'bg-red-50 text-red-600 border border-red-200' },
  discount: { label: 'Discount', icon: <FiTag size={11} />, cls: 'bg-sky-50 text-sky-600 border border-sky-200' },
  seasonal: { label: 'Seasonal', icon: <FiSun size={11} />, cls: 'bg-amber-50 text-amber-600 border border-amber-200' },
  announcement: {
    label: 'Announcement',
    icon: <FiVolume2 size={11} />,
    cls: 'bg-violet-50 text-violet-600 border border-violet-200'
  }
};

const fmt = (d) => (d ? fDate(d) : '—');

function StatusBadge({ status, endDate }) {
  const expired = endDate && new Date(endDate) < new Date();
  if (expired)
    return (
      <span className="inline-block rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400">
        Expired
      </span>
    );
  if (status === 'active')
    return (
      <span className="inline-block rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        Active
      </span>
    );
  return (
    <span className="inline-block rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      Inactive
    </span>
  );
}

export default function CampaignList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const { data, isLoading, isFetching } = useQuery(
    ['admin-campaigns', page, search, type, sortBy, sortOrder],
    () => getCampaignsByAdmin(page, search, type, sortBy, sortOrder),
    { keepPreviousData: true }
  );

  const { mutate: deleteMut } = useMutation((id) => deleteCampaignByAdmin(id), {
    onSuccess: () => {
      Swal.fire({ title: 'Campaign deleted!', icon: 'success', timer: 1200, showConfirmButton: false });
      qc.invalidateQueries('admin-campaigns');
    },
    onError: (e) => Swal.fire('Error', e.response?.data?.message || 'Failed', 'error')
  });

  const handleDelete = async (c) => {
    const r = await Swal.fire({
      title: `Delete "${c.name}"?`,
      text: 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete'
    });
    if (r.isConfirmed) deleteMut(c.id);
  };

  const campaigns = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const columns = [
    {
      key: 'name',
      label: 'Campaign',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.cover?.path ? (
            <Image
              src={c.cover.path}
              className="h-10 w-10 flex-shrink-0 rounded-md border object-cover"
              alt=""
              width={40}
              height={40}
            />
          ) : (
            <div className="h-10 w-10 flex-shrink-0 rounded-md bg-slate-100" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-800">{c.name}</p>
            <p className="truncate text-xs text-slate-400">{c.slug}</p>
          </div>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (c) => {
        const tm = TYPE_META[c.type] || TYPE_META.discount;
        return (
          <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-medium ${tm.cls}`}>
            {tm.icon} {tm.label}
          </span>
        );
      }
    },
    {
      key: 'discount',
      label: 'Discount',
      sortable: true,
      render: (c) => (
        <span className="font-medium text-slate-700">
          {c.discount}
          {c.discountType === 'percent' ? '%' : '৳'} off
        </span>
      )
    },
    {
      key: 'products',
      label: 'Products',
      align: 'right',
      render: (c) => <span className="text-slate-600">{c.products?.length ?? 0}</span>
    },
    {
      key: 'startDate',
      label: 'Period',
      sortable: true,
      render: (c) => (
        <>
          <p className="whitespace-nowrap text-xs text-slate-600">{fmt(c.startDate)}</p>
          <p className="whitespace-nowrap text-xs text-slate-400">→ {fmt(c.endDate)}</p>
        </>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (c) => <StatusBadge status={c.status} endDate={c.endDate} />
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/campaigns/${c.slug}`}
            className="rounded-md p-2 transition hover:bg-slate-100"
            style={{ color: 'var(--brand-strong)' }}
            title="Edit"
          >
            <MdEdit size={17} />
          </Link>
          <button
            onClick={() => handleDelete(c)}
            className="rounded-md p-2 text-red-400 transition hover:bg-red-50"
            title="Delete"
          >
            <MdDelete size={17} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Campaigns" subtitle={`${total} campaign${total !== 1 ? 's' : ''} total`}>
        <Link href="/campaigns/add" className="btn-brand">
          <MdAdd size={18} /> New Campaign
        </Link>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search campaigns…"
        onReset={() => {
          setSearch('');
          setType('');
          setSortBy('');
          setPage(1);
        }}
      >
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[140px]"
        >
          {TYPE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        columns={columns}
        data={campaigns}
        sort={sort}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No campaigns found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="campaigns" />}
      />
    </div>
  );
}
