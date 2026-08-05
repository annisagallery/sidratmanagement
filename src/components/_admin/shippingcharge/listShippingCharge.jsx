'use client';
import { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import * as api from 'src/services';
import { alertError, confirmAction, confirmDelete, toastSuccess } from 'src/utils/swal';
import { MdAdd, MdEdit, MdDelete, MdLocalShipping, MdInbox, MdBlock, MdCheckCircle } from 'react-icons/md';
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

export default function ShippingChargeList() {
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

  const { data, isLoading, isFetching, refetch } = useQuery(
    ['admin-shipping', params],
    () => api.getAllShippingCharges(params),
    {
      keepPreviousData: true,
      onError: (error) => alertError(error, { title: "Couldn't load shipping charges" })
    }
  );

  const isFree = data?.freeShippingEnabled || false;

  const { mutate: toggleFree, isLoading: toggling } = useMutation(
    () => (isFree ? api.disableFreeShipping() : api.enableFreeShipping()),
    {
      onSuccess: () => {
        toastSuccess(
          `Free shipping ${isFree ? 'disabled' : 'enabled'}`,
          isFree ? 'Checkout charges the rates below again.' : 'Every order now ships at no charge.'
        );
        refetch();
      },
      onError: (error) => alertError(error, { title: "Couldn't change free shipping" })
    }
  );

  const areaOf = (charge) => `${charge.district || 'ALL'} · ${charge.upazila || 'ALL'}`;

  const handleDelete = async (charge) => {
    const confirmed = await confirmDelete({
      subject: areaOf(charge),
      text: 'Checkout falls back to the default rate for this area.'
    });
    if (!confirmed) return;
    try {
      await api.deleteShippingChargeByAdmin(charge.id);
      toastSuccess('Shipping charge deleted');
      refetch();
    } catch (error) {
      alertError(error, { title: "Couldn't delete that charge" });
    }
  };

  const setChargeStatus = (chargeStatus) => (charge) =>
    api.updateShippingChargeByAdmin({ id: charge.id, status: chargeStatus });

  const bulkActions = [
    {
      label: 'Activate',
      icon: MdCheckCircle,
      tone: 'success',
      action: 'Activated',
      unit: 'charges',
      confirm: (rows) =>
        confirmAction({
          tone: 'success',
          title: `Activate ${rows.length} shipping charge${rows.length === 1 ? '' : 's'}?`,
          text: 'Checkout starts quoting these rates for their areas.',
          confirmText: 'Activate'
        }),
      perform: setChargeStatus('active'),
      rowLabel: areaOf,
      onSettled: refetch
    },
    {
      label: 'Deactivate',
      icon: MdBlock,
      tone: 'warning',
      action: 'Deactivated',
      unit: 'charges',
      confirm: (rows) =>
        confirmAction({
          tone: 'warning',
          title: `Deactivate ${rows.length} shipping charge${rows.length === 1 ? '' : 's'}?`,
          text: 'Checkout falls back to the default rate for these areas.',
          items: rows.map(areaOf),
          confirmText: 'Deactivate'
        }),
      perform: setChargeStatus('inactive'),
      rowLabel: areaOf,
      onSettled: refetch
    },
    {
      label: 'Delete',
      icon: MdDelete,
      tone: 'danger',
      action: 'Deleted',
      unit: 'charges',
      confirm: (rows) =>
        confirmDelete({
          count: rows.length,
          unit: 'charges',
          subject: rows.length === 1 ? areaOf(rows[0]) : undefined,
          items: rows.map(areaOf),
          text: 'Checkout falls back to the default rate for these areas.'
        }),
      perform: (charge) => api.deleteShippingChargeByAdmin(charge.id),
      rowLabel: areaOf,
      onSettled: refetch
    }
  ];

  const charges = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const columns = [
    {
      key: 'district',
      label: 'District',
      sortable: true,
      render: (c) => <span className="font-semibold text-slate-800">{c.district || c.city_name}</span>
    },
    {
      key: 'upazila',
      label: 'Upazila',
      sortable: true,
      render: (c) => <span className="text-slate-600">{c.upazila || c.zone_name || '—'}</span>
    },
    {
      key: 'charge',
      label: 'Charge',
      sortable: true,
      align: 'right',
      render: (c) => <span className="font-medium text-slate-800">৳{c.charge}</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (c) => <StatusBadge status={c.status === 'deactive' ? 'inactive' : c.status} />
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => router.push(`/shippingcharge/${c.id}`)}
            className="rounded-md p-2 transition hover:bg-slate-100"
            style={{ color: 'var(--brand-strong)' }}
            title="Edit"
          >
            <MdEdit size={17} />
          </button>
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
      {isFree && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <MdLocalShipping size={20} className="flex-shrink-0 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">
            Free Shipping is currently enabled. Saved rules are preserved and can still be managed.
          </p>
        </div>
      )}

      <PageHeader title="Shipping Charges" subtitle={`${total} charge${total !== 1 ? 's' : ''} total`}>
        <button
          onClick={() => toggleFree()}
          disabled={toggling}
          className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-semibold text-white transition hover:brightness-95 ${isFree ? 'bg-red-600' : 'bg-emerald-600'}`}
        >
          <MdLocalShipping size={16} /> {isFree ? 'Disable Free Shipping' : 'Enable Free Shipping'}
        </button>
        <button onClick={() => router.push('/shippingcharge/add')} className="btn-brand">
          <MdAdd size={18} /> Add Charge
        </button>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search by district or upazila..."
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
        data={charges}
        sort={sort}
        selectionLabel="charges"
        exportFileName="shipping-charges-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading || isFetching}
        empty={
          <EmptyState
            title="No shipping charges found"
            hint="Add a default rate or create rates for specific districts and areas."
            icon={MdInbox}
          />
        }
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="charges" />}
      />
    </div>
  );
}
