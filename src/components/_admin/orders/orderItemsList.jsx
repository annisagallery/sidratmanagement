'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { FiExternalLink } from 'react-icons/fi';
import { MdInbox } from 'react-icons/md';
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

export default function OrderItemsList() {
  const router = useRouter();
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
    onError: (err) => Swal.fire(err?.response?.data?.message || 'Something went wrong!', '', 'error')
  });

  const items = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;

  const toggleDelivery = () => {
    setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  };
  const sort = { by: 'estimatedDelivery', order: sortOrder, onSort: toggleDelivery };

  const columns = [
    { key: 'code', label: 'Code', render: (item) => <span className="font-mono text-xs font-semibold tracking-wider text-slate-500">{item.code || '—'}</span> },
    {
      key: 'product',
      label: 'Product',
      render: (item) => {
        const attrs = (item.attributes || []).map((a) => a.valueName).filter(Boolean).join(', ');
        return (
          <div className="max-w-[200px]">
            <p className="truncate text-[13px] font-medium text-slate-800">{item.product?.name || 'Unknown product'}</p>
            {attrs && <p className="truncate text-[11px] text-slate-400">{attrs}</p>}
            {item.customizeDetails && <p className="truncate text-[11px]" style={{ color: 'var(--brand-strong)' }}>{item.customizeDetails}</p>}
          </div>
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
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No order items found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="items" />}
      />
    </div>
  );
}
