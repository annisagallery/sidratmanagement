'use client';
import { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import * as api from 'src/services';
import { alertError, confirmAction, confirmDelete, toastSuccess } from 'src/utils/swal';
import { MdAdd, MdDelete, MdLocalShipping, MdInbox, MdBlock, MdCheckCircle } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { RecordStatus } from 'src/components/_admin/ui/Badge';
import { coverageSummary } from './areas';

const STATUS_OPTS = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
];

const fmtCharge = (charge) => (Number(charge) === 0 ? 'Free' : `৳${Number(charge).toLocaleString('en-BD')}`);

// One row per zone: a price and the areas it covers, edited together.
export default function ShippingChargeList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const params = { ...(query && { search: query }), ...(status && { status }) };

  const { data, isLoading, isFetching, refetch, isError, error: loadError } = useQuery(
    ['admin-shipping-zones', params],
    () => api.getShippingZones(params),
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
          isFree ? 'Checkout charges the zones below again.' : 'Every order now ships at no charge.'
        );
        refetch();
      },
      onError: (error) => alertError(error, { title: "Couldn't change free shipping" })
    }
  );

  const nameOf = (zone) => zone.name;

  const handleDelete = async (zone) => {
    const confirmed = await confirmDelete({
      subject: zone.name,
      text: `Its ${zone.areas.length} area${zone.areas.length === 1 ? '' : 's'} fall back to the next matching zone at checkout.`
    });
    if (!confirmed) return;
    try {
      await api.deleteShippingZone(zone.id);
      toastSuccess('Shipping zone deleted');
      refetch();
    } catch (error) {
      alertError(error, { title: "Couldn't delete that zone" });
    }
  };

  const setStatusTo = (next) => (zone) => api.setShippingZoneStatus({ id: zone.id, status: next });

  const bulkActions = [
    {
      label: 'Activate',
      icon: MdCheckCircle,
      tone: 'success',
      action: 'Activated',
      unit: 'zones',
      confirm: (rows) =>
        confirmAction({
          tone: 'success',
          title: `Activate ${rows.length} shipping zone${rows.length === 1 ? '' : 's'}?`,
          text: 'Checkout starts charging these zones for their areas.',
          confirmText: 'Activate'
        }),
      perform: setStatusTo('active'),
      rowLabel: nameOf,
      onSettled: refetch
    },
    {
      label: 'Deactivate',
      icon: MdBlock,
      tone: 'warning',
      action: 'Deactivated',
      unit: 'zones',
      confirm: (rows) =>
        confirmAction({
          tone: 'warning',
          title: `Deactivate ${rows.length} shipping zone${rows.length === 1 ? '' : 's'}?`,
          text: 'Their areas fall back to the next matching zone at checkout.',
          items: rows.map(nameOf),
          confirmText: 'Deactivate'
        }),
      perform: setStatusTo('inactive'),
      rowLabel: nameOf,
      onSettled: refetch
    },
    {
      label: 'Delete',
      icon: MdDelete,
      tone: 'danger',
      action: 'Deleted',
      unit: 'zones',
      confirm: (rows) =>
        confirmDelete({
          count: rows.length,
          unit: 'zones',
          subject: rows.length === 1 ? rows[0].name : undefined,
          items: rows.map(nameOf),
          text: 'Their areas fall back to the next matching zone at checkout.'
        }),
      perform: (zone) => api.deleteShippingZone(zone.id),
      rowLabel: nameOf,
      onSettled: refetch
    }
  ];

  const zones = data?.data || [];
  const total = data?.total || 0;

  const columns = [
    {
      key: 'name',
      label: 'Zone',
      render: (z) => <span className="font-semibold text-slate-800">{z.name}</span>
    },
    {
      key: 'areas',
      label: 'Covers',
      render: (z) => (
        <div className="min-w-0 max-w-[520px]">
          <p className="truncate text-[13px] text-slate-600" title={coverageSummary(z.areas, z.areas.length)}>
            {coverageSummary(z.areas)}
          </p>
          <p className="text-xs text-slate-400">
            {z.areas.length} area{z.areas.length === 1 ? '' : 's'}
          </p>
        </div>
      )
    },
    {
      key: 'charge',
      label: 'Charge',
      align: 'right',
      render: (z) => <span className="font-medium tabular-nums text-slate-800">{fmtCharge(z.charge)}</span>
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (z) => <RecordStatus status={z.status} />
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (z) => (
        <div className="flex items-center justify-end gap-1" onClick={stopRow}>
          <button type="button" onClick={() => router.push(`/shippingcharge/${z.id}`)} className="btn-ghost btn-sm">
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleDelete(z)}
            className="btn-icon btn-icon-sm btn-icon-danger"
            aria-label={`Delete the ${z.name} zone`}
            title="Delete"
          >
            <MdDelete size={18} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {isFree && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <MdLocalShipping size={20} className="flex-shrink-0 text-amber-700" />
          <p className="text-sm font-semibold text-amber-800">
            Free Shipping is currently enabled. Saved zones are preserved and can still be managed.
          </p>
        </div>
      )}

      <PageHeader
        title="Shipping Charges"
        subtitle={`${total} zone${total !== 1 ? 's' : ''} · checkout charges the zone holding the exact area, then the whole district, then any district`}
      >
        <button type="button"
          onClick={() => toggleFree()}
          disabled={toggling}
          className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-semibold text-white transition hover:brightness-95 ${isFree ? 'bg-rose-600' : 'bg-emerald-600'}`}
        >
          <MdLocalShipping size={16} /> {isFree ? 'Disable Free Shipping' : 'Enable Free Shipping'}
        </button>
        <button type="button" onClick={() => router.push('/shippingcharge/add')} className="btn-brand">
          <MdAdd size={18} /> Add zone
        </button>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setQuery(search.trim())}
        searchPlaceholder="Search by zone, district or upazila..."
        onReset={() => {
          setSearch('');
          setQuery('');
          setStatus('');
        }}
      >
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select-ui min-w-[140px]">
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        onRowClick={(z) => router.push(`/shippingcharge/${z.id}`)}
        rowLabel={() => 'Edit shipping zone'}
        error={isError ? loadError : null}
        onRetry={refetch}
        columns={columns}
        data={zones}
        selectionLabel="zones"
        exportFileName="shipping-zones-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading}
        isFetching={isFetching}
        empty={
          <EmptyState
            title="No shipping zones found"
            hint="Add a zone with a price for a set of districts or areas, and an any-district zone as the fallback."
            icon={MdInbox}
          />
        }
      />
    </div>
  );
}
