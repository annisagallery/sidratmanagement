'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import * as api from 'src/services';
import { toastSuccess, alertError, promptSelect, promptText } from 'src/utils/swal';
import { MdOpenInNew, MdOutlineLocalShipping, MdRefresh, MdWarningAmber } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import Badge from 'src/components/_admin/ui/Badge';
import { EmptyState } from 'src/components/_admin/ui/TableStates';

const PAGE_SIZE = 20;

const PROVIDER_LABEL = { pathao: 'Pathao', steadfast: 'Steadfast', carrybee: 'CarryBee' };

const STATUS_META = {
  pending: { label: 'Pending pickup', tone: 'neutral' },
  in_transit: { label: 'In transit', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  partial_delivered: { label: 'Partly delivered', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  returned: { label: 'Returned', tone: 'warning' },
  hold: { label: 'On hold', tone: 'warning' },
  unknown: { label: 'Unknown', tone: 'neutral' }
};

const INTENT_META = {
  prepared: { label: 'Prepared', tone: 'neutral' },
  submitting: { label: 'Submitting', tone: 'info' },
  submitted: { label: 'Submitted', tone: 'success' },
  failed: { label: 'Safe to retry', tone: 'warning' },
  requires_review: { label: 'Review required', tone: 'danger' }
};

const SUBMITTING_REVIEW_AFTER_MS = 15 * 60 * 1000;

function intentNeedsReview(shipment) {
  if (shipment.intentStatus === 'requires_review') return true;
  if (shipment.intentStatus !== 'submitting' || !shipment.submissionStartedAt) return false;
  return Date.now() - new Date(shipment.submissionStartedAt).getTime() >= SUBMITTING_REVIEW_AFTER_MS;
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

function IntentPill({ status }) {
  const meta = INTENT_META[status];
  if (!meta || status === 'submitted') return null;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
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

  const { data, isLoading, isFetching, refetch, isError, error: loadError } = useQuery(
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
      alertError(e, { title: 'The status could not be refreshed' });
    } finally {
      setRefreshingId(null);
    }
  };

  const reconcileIntent = async (shipment) => {
    const courier = PROVIDER_LABEL[shipment.provider] || shipment.provider;
    const resolution = await promptSelect({
      tone: 'warning',
      title: 'Reconcile this courier request',
      text: `Check invoice ${shipment.invoice || shipment.orderNo} in the ${courier} dashboard, then say what you found.`,
      options: [
        { value: 'CONFIRMED_CREATED', label: `${courier} created the parcel` },
        { value: 'CONFIRMED_NOT_CREATED', label: `${courier} did not create it` }
      ],
      placeholder: 'What does the courier show?',
      confirmText: 'Continue'
    });
    if (!resolution) return;
    const created = resolution === 'CONFIRMED_CREATED';

    let consignmentId = '';
    if (created) {
      const value = await promptText({
        title: 'Record the consignment ID',
        text: 'Use the exact ID shown by the courier.',
        label: 'Consignment ID',
        placeholder: 'Consignment ID',
        requiredMessage: 'The consignment ID is required.',
        multiline: false,
        confirmText: 'Continue'
      });
      if (value === null) return;
      consignmentId = value;
    }

    const note = await promptText({
      title: 'How did you check?',
      text: 'Kept with the shipment so anyone can see how it was reconciled.',
      label: 'Verification note',
      placeholder: 'Checked the courier dashboard, account, time or support reference…',
      requiredMessage: 'Add a short verification note.',
      validate: (value) => (value.length < 5 ? 'Add a short verification note.' : undefined),
      confirmText: 'Record'
    });
    if (note === null) return;

    setReviewingId(shipment.id);
    try {
      const response = await api.reconcileShipmentIntent({
        id: shipment.id,
        resolution,
        consignmentId: created ? consignmentId : undefined,
        note
      });
      await refetch();
      toastSuccess('Recorded', response?.message || 'Shipment request reconciled.');
    } catch (error) {
      await alertError(error, { title: 'The request could not be reconciled' });
    } finally {
      setReviewingId(null);
    }
  };

  const filtered = Boolean(search || provider || status);

  const columns = [
    {
      key: 'orderNo',
      label: 'Order',
      render: (s) => (
        <div>
          <Link href={`/orders/${s.orderNo}`} onClick={stopRow} className="ops-code text-[13px] font-semibold text-slate-900 hover:underline">
            #{s.orderNo}
          </Link>
          {!s.isActive && <p className="text-xs text-slate-500">Superseded</p>}
        </div>
      )
    },
    {
      key: 'provider',
      label: 'Courier',
      render: (s) => (
        <div>
          <p className="text-[13px] text-slate-900">{PROVIDER_LABEL[s.provider] || s.provider}</p>
          {s.accountName && <p className="text-xs text-slate-500">{s.accountName}</p>}
        </div>
      )
    },
    {
      key: 'consignmentId',
      label: 'Consignment',
      hideBelow: 'md',
      render: (s) => (
        <div>
          <span className="ops-code text-[13px] text-slate-700">{s.consignmentId || '—'}</span>
          {s.trackingCode && s.trackingCode !== s.consignmentId && <p className="ops-code text-xs text-slate-500">{s.trackingCode}</p>}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (s) => (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            <StatusPill status={s.status} />
            <IntentPill status={s.intentStatus} />
          </div>
          {s.providerStatus && <p className="text-xs capitalize text-slate-500">{String(s.providerStatus).replace(/[_-]/g, ' ')}</p>}
        </div>
      )
    },
    {
      key: 'codAmount',
      label: 'Cash on delivery',
      align: 'right',
      render: (s) => <span className="font-semibold tabular-nums text-slate-900">৳{Number(s.codAmount || 0).toLocaleString()}</span>
    },
    {
      key: 'createdAt',
      label: 'Sent',
      hideBelow: 'lg',
      render: (s) => <span className="whitespace-nowrap text-slate-600">{format(new Date(s.createdAt), 'dd MMM yyyy, h:mm a')}</span>
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (s) => {
        const url = trackingUrl(s);
        return (
          <div className="flex items-center justify-end gap-1" onClick={stopRow}>
            {intentNeedsReview(s) && (
              <button
                type="button"
                onClick={() => reconcileIntent(s)}
                disabled={reviewingId === s.id}
                title="Reconcile this uncertain courier request"
                className="btn-ghost btn-sm text-rose-700"
              >
                <MdWarningAmber size={16} aria-hidden /> Review
              </button>
            )}
            <button
              type="button"
              onClick={() => refresh(s)}
              disabled={refreshingId === s.id || !s.consignmentId}
              title={s.consignmentId ? 'Refresh status from the courier' : 'Reconcile the request before refreshing'}
              aria-label={`Refresh the status of order ${s.orderNo}`}
              className="btn-icon btn-icon-sm"
            >
              <MdRefresh size={17} className={refreshingId === s.id ? 'animate-spin' : ''} aria-hidden />
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                title="Track on Steadfast"
                aria-label={`Track order ${s.orderNo} on Steadfast (opens in a new tab)`}
                className="btn-icon btn-icon-sm"
              >
                <MdOpenInNew size={16} aria-hidden />
              </a>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Shipments" subtitle="Every parcel sent to a courier. Statuses update on their own through webhooks." />

      <ListToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSubmit={applySearch}
        searchPlaceholder="Order, consignment or tracking number…"
        onRefresh={() => refetch()}
        onReset={
          filtered || searchInput
            ? () => {
                setSearchInput('');
                setSearch('');
                setProvider('');
                setStatus('');
                setPage(1);
              }
            : undefined
        }
      >
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setPage(1);
          }}
          className="select-ui"
          aria-label="Courier"
        >
          <option value="">All couriers</option>
          {Object.entries(PROVIDER_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="select-ui"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        caption="Shipments"
        columns={columns}
        data={shipments}
        selectable={false}
        isLoading={isLoading}
        isFetching={isFetching}
        error={isError ? loadError : null}
        onRetry={refetch}
        empty={
          filtered ? (
            <EmptyState title="No shipments match" hint="Try another courier or status, or clear the search." />
          ) : (
            <EmptyState icon={MdOutlineLocalShipping} title="No shipments yet" hint="Send one from an order page and it appears here." />
          )
        }
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
      />
    </div>
  );
}
