'use client';
import { useRouter } from 'next-nprogress-bar';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Link from 'next/link';
import Image from 'next/image';
import { MdAdd, MdEdit, MdDelete, MdInbox, MdPlayArrow, MdPause } from 'react-icons/md';
import { FiZap, FiTag, FiSun, FiVolume2 } from 'react-icons/fi';
import { getCampaignsByAdmin, deleteCampaignByAdmin, updateCampaignByAdmin } from 'src/services';
import { alertError, confirmAction, confirmDelete, toastSuccess } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDate } from 'src/utils/formatTime';
import Badge, { RecordStatus } from 'src/components/_admin/ui/Badge';

const TYPE_OPTS = [
  { label: 'All types', value: '' },
  { label: 'Flash sale', value: 'flash_sale' },
  { label: 'Discount', value: 'discount' },
  { label: 'Seasonal', value: 'seasonal' },
  { label: 'Announcement', value: 'announcement' }
];

const TYPE_META = {
  flash_sale: { label: 'Flash sale', icon: FiZap, tone: 'danger' },
  discount: { label: 'Discount', icon: FiTag, tone: 'info' },
  seasonal: { label: 'Seasonal', icon: FiSun, tone: 'warning' },
  announcement: { label: 'Announcement', icon: FiVolume2, tone: 'violet' }
};

const fmt = (d) => (d ? fDate(d) : '—');

function StatusBadge({ status, endDate }) {
  const expired = endDate && new Date(endDate) < new Date();
  return <RecordStatus status={expired ? 'expired' : status === 'active' ? 'active' : 'inactive'} />;
}

export default function CampaignList() {
  const router = useRouter();
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

  const { data, isLoading, isFetching, isError, error: loadError, refetch } = useQuery(
    ['admin-campaigns', page, search, type, sortBy, sortOrder],
    () => getCampaignsByAdmin(page, search, type, sortBy, sortOrder),
    { keepPreviousData: true }
  );

  const { mutate: deleteMut } = useMutation((id) => deleteCampaignByAdmin(id), {
    onSuccess: () => {
      toastSuccess('Campaign deleted');
      qc.invalidateQueries('admin-campaigns');
    },
    onError: (error) => alertError(error, { title: "Couldn't delete that campaign" })
  });

  const handleDelete = async (campaign) => {
    const confirmed = await confirmDelete({
      subject: campaign.name,
      text: 'Products in the campaign go back to their regular pricing immediately.'
    });
    if (confirmed) deleteMut(campaign.id);
  };

  const refreshCampaigns = () => qc.invalidateQueries('admin-campaigns');

  const setCampaignStatus = (status) => (campaign) =>
    updateCampaignByAdmin({ currentSlug: campaign.slug, status });

  const bulkActions = [
    {
      label: 'Activate',
      icon: MdPlayArrow,
      tone: 'success',
      action: 'Activated',
      unit: 'campaigns',
      confirm: (rows) =>
        confirmAction({
          tone: 'success',
          title: `Activate ${rows.length} campaign${rows.length === 1 ? '' : 's'}?`,
          text: 'Campaign pricing applies to shoppers straight away, within each campaign’s date range.',
          confirmText: 'Activate'
        }),
      perform: setCampaignStatus('active'),
      onSettled: refreshCampaigns
    },
    {
      label: 'Pause',
      icon: MdPause,
      tone: 'warning',
      action: 'Paused',
      unit: 'campaigns',
      confirm: (rows) =>
        confirmAction({
          tone: 'warning',
          title: `Pause ${rows.length} campaign${rows.length === 1 ? '' : 's'}?`,
          text: 'Products revert to regular pricing until the campaign is activated again.',
          confirmText: 'Pause'
        }),
      perform: setCampaignStatus('inactive'),
      onSettled: refreshCampaigns
    },
    {
      label: 'Delete',
      icon: MdDelete,
      tone: 'danger',
      action: 'Deleted',
      unit: 'campaigns',
      confirm: (rows) =>
        confirmDelete({
          count: rows.length,
          unit: 'campaigns',
          subject: rows.length === 1 ? rows[0].name : undefined,
          items: rows.map((campaign) => campaign.name),
          text: 'Products in these campaigns go back to their regular pricing immediately.'
        }),
      perform: (campaign) => deleteCampaignByAdmin(campaign.id),
      onSettled: refreshCampaigns
    }
  ];

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
              className="h-10 w-10 flex-shrink-0 rounded-md border border-slate-200 object-cover"
              alt=""
              width={40}
              height={40}
            />
          ) : (
            <div className="h-10 w-10 flex-shrink-0 rounded-md bg-slate-100" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{c.name}</p>
            <p className="truncate text-xs text-slate-500">{c.slug}</p>
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
        const Icon = tm.icon;
        return (
          <Badge tone={tm.tone}>
            <Icon size={11} aria-hidden /> {tm.label}
          </Badge>
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
          <p className="whitespace-nowrap text-xs text-slate-500">→ {fmt(c.endDate)}</p>
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
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={stopRow}>
          <Link href={`/campaigns/${c.slug}`} className="btn-ghost btn-sm">
            Edit
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(c)}
            className="btn-icon btn-icon-sm btn-icon-danger"
            aria-label={`Delete ${c.title || c.name || 'campaign'}`}
            title="Delete"
          >
            <MdDelete size={18} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Campaigns" subtitle={`${total} campaign${total !== 1 ? 's' : ''} total`}>
        <Link href="/campaigns/add" className="btn-brand">
          <MdAdd size={18} /> New campaign
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
          aria-label="Campaign type"
        >
          {TYPE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        onRowClick={(c) => router.push(`/campaigns/${c.slug}`)}
        rowLabel={(c) => `Edit ${c.title || c.name || 'campaign'}`}
        error={isError ? loadError : null}
        onRetry={refetch}
        columns={columns}
        data={campaigns}
        sort={sort}
        selectionLabel="campaigns"
        exportFileName="campaigns-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading}
        isFetching={isFetching}
        empty={<EmptyState title="No campaigns found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="campaigns" />}
      />
    </div>
  );
}
