'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { FiAlertTriangle, FiExternalLink, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { MdOutlineLocalShipping } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';

const PAGE_SIZE = 20;

const PROVIDER_LABEL = { pathao: 'Pathao', steadfast: 'Steadfast', carrybee: 'CarryBee' };

const STATUS_META = {
  pending: { label: 'Pending pickup', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_transit: { label: 'In transit', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial_delivered: { label: 'Partial delivered', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border-red-200' },
  returned: { label: 'Returned', cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  hold: { label: 'On hold', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  unknown: { label: 'Unknown', cls: 'bg-gray-100 text-gray-500 border-gray-200' }
};

const INTENT_META = {
  prepared: { label: 'Prepared', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  submitting: { label: 'Submitting', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  submitted: { label: 'Submitted', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Safe to retry', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  requires_review: { label: 'Review required', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
};

const SUBMITTING_REVIEW_AFTER_MS = 15 * 60 * 1000;

function intentNeedsReview(shipment) {
  if (shipment.intentStatus === 'requires_review') return true;
  if (shipment.intentStatus !== 'submitting' || !shipment.submissionStartedAt) return false;
  return Date.now() - new Date(shipment.submissionStartedAt).getTime() >= SUBMITTING_REVIEW_AFTER_MS;
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>;
}

function IntentPill({ status }) {
  const meta = INTENT_META[status];
  if (!meta || status === 'submitted') return null;
  return <span className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>;
}

const trackingUrl = (s) => (s.provider === 'steadfast' && s.trackingCode ? `https://steadfast.com.bd/t/${s.trackingCode}` : null);

export default function ShipmentsList() {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [refreshingId, setRefreshingId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);

  const { data, isLoading, refetch } = useQuery(
    ['admin-shipments', page, provider, status, search],
    () => api.getShipmentsByAdmin({ page, limit: PAGE_SIZE, provider: provider || undefined, status: status || undefined, search: search || undefined }),
    { keepPreviousData: true }
  );
  const shipments = data?.data || [];

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const refresh = async (shipment) => {
    setRefreshingId(shipment.id);
    try {
      await api.refreshShipmentStatus(shipment.id);
      await refetch();
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || 'Could not refresh from the courier', 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  const reconcileIntent = async (shipment) => {
    const choice = await Swal.fire({
      title: 'Reconcile courier request',
      text: `Check invoice ${shipment.invoice || shipment.orderNo} in the ${PROVIDER_LABEL[shipment.provider] || shipment.provider} dashboard before choosing.`,
      icon: 'warning',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Courier created it',
      denyButtonText: 'Not created',
      reverseButtons: true
    });
    if (!choice.isConfirmed && !choice.isDenied) return;

    let consignmentId = '';
    if (choice.isConfirmed) {
      const consignment = await Swal.fire({
        title: 'Record consignment ID',
        input: 'text',
        inputLabel: 'Use the exact ID shown by the courier',
        inputPlaceholder: 'Consignment ID',
        showCancelButton: true,
        inputValidator: (value) => (!String(value || '').trim() ? 'Consignment ID is required.' : undefined)
      });
      if (!consignment.isConfirmed) return;
      consignmentId = String(consignment.value || '').trim();
    }

    const evidence = await Swal.fire({
      title: 'Record verification evidence',
      input: 'textarea',
      inputLabel: 'How did you verify the courier result?',
      inputPlaceholder: 'Checked courier dashboard, account, time, or support reference…',
      showCancelButton: true,
      inputValidator: (value) => (String(value || '').trim().length < 5 ? 'Add a short verification note.' : undefined)
    });
    if (!evidence.isConfirmed) return;

    setReviewingId(shipment.id);
    try {
      const response = await api.reconcileShipmentIntent({
        id: shipment.id,
        resolution: choice.isConfirmed ? 'CONFIRMED_CREATED' : 'CONFIRMED_NOT_CREATED',
        consignmentId: choice.isConfirmed ? consignmentId : undefined,
        note: String(evidence.value || '').trim()
      });
      await refetch();
      await Swal.fire('Recorded', response?.message || 'Shipment intent reconciled.', 'success');
    } catch (error) {
      await Swal.fire('Could not reconcile', error?.response?.data?.message || 'Reload and try again.', 'error');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shipments"
        subtitle="Every parcel sent to a courier — statuses update automatically via webhooks"
        icon={MdOutlineLocalShipping}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            placeholder="Order no / consignment / tracking…"
            className="border border-gray-200 rounded-md pl-8 pr-3 py-2 text-sm w-72 focus:outline-none focus:border-[var(--brand)]"
          />
          <FiSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setPage(1);
          }}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--brand)]"
        >
          <option value="">All couriers</option>
          <option value="pathao">Pathao</option>
          <option value="steadfast">Steadfast</option>
          <option value="carrybee">CarryBee</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--brand)]"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && !shipments.length ? (
        <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
      ) : !shipments.length ? (
        <div className="text-center py-14 text-sm text-gray-500 border border-dashed border-gray-300 rounded-md">
          No shipments{search || provider || status ? ' match these filters' : ' yet — send one from an order page'}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <DataTable
            className="w-full"
            footer={
              <Pagination
                page={data?.page || page}
                totalPages={data?.totalPages || 1}
                total={data?.total}
                unit="shipments"
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            }
          >
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Order</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Courier</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Consignment</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-right text-xs text-gray-500 uppercase tracking-wide">COD</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Sent</th>
                <th className="px-4 py-2.5 text-right text-xs text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => {
                const url = trackingUrl(s);
                return (
                  <tr key={s.id} className={`border-b border-gray-100 hover:bg-gray-50/50 ${s.isActive ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-3">
                      <Link href={`/orders/${s.orderNo}`} className="text-sm font-semibold text-[var(--brand-strong)] hover:underline">
                        #{s.orderNo}
                      </Link>
                      {!s.isActive && <p className="text-[10px] font-semibold uppercase text-gray-400">superseded</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{PROVIDER_LABEL[s.provider] || s.provider}</p>
                      <p className="text-[11px] text-gray-400">{s.accountName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600">{s.consignmentId}</span>
                      {s.trackingCode && s.trackingCode !== s.consignmentId && (
                        <p className="font-mono text-[11px] text-gray-400">{s.trackingCode}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                      <div><IntentPill status={s.intentStatus} /></div>
                      {s.providerStatus && (
                        <p className="mt-0.5 text-[11px] capitalize text-gray-400">{String(s.providerStatus).replace(/[_-]/g, ' ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">৳{s.codAmount || 0}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{format(new Date(s.createdAt), 'dd/MM/yyyy hh:mm a')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => refresh(s)}
                          disabled={refreshingId === s.id || !s.consignmentId}
                          title={s.consignmentId ? 'Refresh status from the courier' : 'Reconcile the intent before refreshing'}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-md transition disabled:opacity-50"
                        >
                          <FiRefreshCw size={13} className={refreshingId === s.id ? 'animate-spin' : ''} />
                        </button>
                        {intentNeedsReview(s) && (
                          <button
                            onClick={() => reconcileIntent(s)}
                            disabled={reviewingId === s.id}
                            title="Reconcile this uncertain courier request"
                            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            <FiAlertTriangle size={13} />
                            Review
                          </button>
                        )}
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            title="Track parcel"
                            className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-md transition"
                          >
                            <FiExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      )}
    </div>
  );
}
