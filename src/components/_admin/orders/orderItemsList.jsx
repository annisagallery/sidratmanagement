'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import * as api from 'src/services';
import { alertError, alertInfo, confirmAction } from 'src/utils/swal';
import { FiExternalLink, FiPackage } from 'react-icons/fi';
import { MdInbox, MdInventory } from 'react-icons/md';
import { useStatuses } from 'src/components/_admin/shared/useStatuses';
import { StatusBadge, StatusSelect } from 'src/components/_admin/shared/StatusBadge';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDate } from 'src/utils/formatTime';

function TagChips({ tags = [] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id || tag.slug}
          className="inline-block rounded-md px-1.5 text-[10px] font-medium leading-5"
          style={{
            backgroundColor: tag.color ? `${tag.color}22` : '#f3f4f6',
            color: tag.color || '#6b7280',
            border: `1px solid ${tag.color ? `${tag.color}55` : '#e5e7eb'}`
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

const fmtDate = (d) => (d ? fDate(d) : '—');

// Only these two states can take a piece off the shelf; anything already bound
// to a unit or sitting in a batch is left alone.
const STOCK_ASSIGNABLE = new Set(['processing', 'production-needed']);

export default function OrderItemsList() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('asc');
  const limit = 20;

  const { statuses } = useStatuses('orderItem');

  const params = new URLSearchParams({
    page,
    limit,
    sortOrder,
    ...(search && { search }),
    ...(status && { status })
  }).toString();

  const { data, isLoading, isFetching } = useQuery(['admin-order-items', params], () => api.getOrderItemsByAdmin(params), {
    keepPreviousData: true,
    onError: (error) => alertError(error, { title: "Couldn't load order items" })
  });

  const items = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;

  const itemLabel = (item) => `#${item.order?.orderNo} · ${item.product?.name || 'Unknown product'}`;

  const bulkActions = [
    {
      label: 'Reserve ready stock',
      icon: MdInventory,
      tone: 'success',
      action: 'Reserved stock for',
      unit: 'items',
      hint: 'Take a finished piece from HQ stock for each item that still needs one',
      confirm: (rows) => {
        const eligible = rows.filter((item) => STOCK_ASSIGNABLE.has(item.status));
        if (!eligible.length) {
          alertInfo(
            'Nothing to reserve',
            'These items are already bound to a piece, in production, or part of a batch.'
          );
          return false;
        }
        return confirmAction({
          tone: 'success',
          title: `Reserve stock for ${eligible.length} item${eligible.length === 1 ? '' : 's'}?`,
          text: 'Each item takes the oldest matching piece in HQ stock. Items with no matching stock are reported back.',
          items: eligible.map(itemLabel),
          confirmText: 'Reserve'
        });
      },
      perform: async (item) => {
        if (!STOCK_ASSIGNABLE.has(item.status)) return;
        await api.assignProductionNeedToStock(item.id);
      },
      rowLabel: itemLabel,
      onSettled: () => {
        qc.invalidateQueries(['admin-order-items']);
        qc.invalidateQueries(['production-needs']);
      }
    }
  ];

  const toggleDelivery = () => {
    setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  };
  const sort = { by: 'estimatedDelivery', order: sortOrder, onSort: toggleDelivery };

  const columns = [
    {
      key: 'product',
      label: 'Product',
      render: (item) => {
        const attrs = (item.attributes || []).map((a) => a.valueName).filter(Boolean).join(', ');
        const image = item.product?.featuredImage?.path || item.pid?.featuredImage?.path;
        return (
          <div className="flex items-start gap-2.5">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              {image ? (
                <Image src={image} alt="" fill sizes="40px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-slate-300">
                  <FiPackage size={15} />
                </span>
              )}
            </div>
            <div className="max-w-[200px]">
              <p className="truncate text-[13px] font-medium text-slate-800">{item.product?.name || 'Unknown product'}</p>
              {attrs && <p className="truncate text-[11px] text-slate-400">{attrs}</p>}
              {item.customizeDetails && <p className="truncate text-[11px]" style={{ color: 'var(--brand-strong)' }}>{item.customizeDetails}</p>}
            </div>
          </div>
        );
      }
    },
    {
      // The production code of the physical piece. The bound unit is the piece
      // this item actually owns; a unit still on the line is shown muted, since
      // a code on screen must never read as a piece in hand.
      key: 'code',
      label: 'Production code',
      render: (item) => {
        const bound = item.packingBarcode || item.assignedUnit?.barcode;
        const inProgress = item.productionUnits?.[0];
        const code = bound || inProgress?.barcode;
        if (!code) return <span className="text-xs text-slate-300">—</span>;
        return (
          <span
            title={bound ? 'Piece bound to this item' : `Being made — unit is ${inProgress?.status}`}
            className={`font-mono text-xs font-semibold tracking-wider ${bound ? 'text-slate-600' : 'text-slate-400'}`}
          >
            {code}
          </span>
        );
      }
    },
    {
      key: 'order',
      label: 'Order',
      render: (item) => {
        const order = item.order || {};
        return (
          <>
            <button
              type="button"
              onClick={() => router.push(`/orders/${order.orderNo}`)}
              className="flex items-center gap-1 font-mono text-[13px] font-semibold text-slate-700 transition hover:underline"
            >
              #{order.orderNo}
              <FiExternalLink size={11} className="opacity-50" />
            </button>
            <TagChips tags={order.tags} />
          </>
        );
      }
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (item) => {
        const addr = item.order?.shippingAddress || {};
        return (
          <>
            <p className="max-w-[130px] truncate text-[13px] text-slate-700">{addr.name || '—'}</p>
            <p className="text-[11px] text-slate-400">{addr.phone || ''}</p>
          </>
        );
      }
    },
    { key: 'qty', label: 'Qty', align: 'center', render: (item) => <span className="text-slate-700">{item.quantity}</span> },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      render: (item) => (
        <>
          <span className="font-semibold text-slate-800">৳{item.price}</span>
          {item.customizePrice > 0 && <p className="text-[10px]" style={{ color: 'var(--brand-strong)' }}>+৳{item.customizePrice} custom</p>}
        </>
      )
    },
    {
      key: 'estimatedDelivery',
      label: 'Delivery',
      sortable: true,
      render: (item) => (
        <span className={`text-xs font-medium ${item.order?.estimatedDelivery ? 'text-slate-800' : 'text-slate-400'}`}>
          {fmtDate(item.order?.estimatedDelivery)}
        </span>
      )
    },
    { key: 'createdAt', label: 'Ordered', render: (item) => <span className="text-xs text-slate-500">{fmtDate(item.createdAt)}</span> },
    { key: 'status', label: 'Status', align: 'center', render: (item) => <StatusBadge status={item.status} statuses={statuses} /> }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Order Items" subtitle={`${total} item${total !== 1 ? 's' : ''} · sorted by delivery date`} />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search by order number…"
        onReset={() => {
          setSearch('');
          setStatus('');
          setSortOrder('asc');
          setPage(1);
        }}
      >
        <StatusSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          statuses={statuses}
          className="select-ui min-w-[140px]"
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        data={items}
        sort={sort}
        selectionLabel="items"
        exportFileName="order-items-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No order items found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="items" />}
      />
    </div>
  );
}
