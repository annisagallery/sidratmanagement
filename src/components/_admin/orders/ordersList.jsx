'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import Swal from 'sweetalert2';
import { BsCartPlus } from 'react-icons/bs';
import { MdChevronRight, MdInbox } from 'react-icons/md';

import * as api from 'src/services';
import DataTable from 'src/components/_admin/ui/DataTable';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { StatusBadge, StatusSelect } from 'src/components/_admin/shared/StatusBadge';
import { useStatuses } from 'src/components/_admin/shared/useStatuses';
import { fDate, fDateTime } from 'src/utils/formatTime';

const PAYMENT_STYLE = {
  paid: 'bg-emerald-100 text-emerald-700',
  unpaid: 'bg-slate-100 text-slate-500',
  refunded: 'bg-amber-100 text-amber-700'
};

function PaymentBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${PAYMENT_STYLE[status] || 'bg-slate-100 text-slate-500'}`}
    >
      {status || '—'}
    </span>
  );
}

function TagChips({ tags = [] }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag._id || tag.slug}
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

const fmtDate = (date) => (date ? fDate(date) : '—');

const fmtMoney = (amount) =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(amount || 0);

const sourceLabel = (order) => {
  if (order.source === 'showroom') return 'Showroom';
  // Older manual showroom orders were stored as POS. Treat only a due date
  // materially later than checkout as manual; instant POS due dates match
  // their creation time.
  const dueGap =
    order.estimatedDelivery && order.createdAt
      ? new Date(order.estimatedDelivery).getTime() - new Date(order.createdAt).getTime()
      : 0;
  if (order.source === 'pos' && dueGap > 60 * 60 * 1000) return 'Showroom';
  return { online: 'Online', admin: 'CC', pos: 'POS' }[order.source] || 'Online';
};

export default function OrderList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [view, setView] = useState('active');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('estimatedDelivery');
  const [sortOrder, setSortOrder] = useState('asc');
  const limit = 20;

  const { statuses } = useStatuses('order');

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // This page is the fulfillment queue only — POS counter sales live under
  // the dedicated POS Sales page (/pos-sales).
  const params = new URLSearchParams({
    page,
    limit,
    channel: 'orders',
    ...(search && { search }),
    ...(status ? { status } : { view }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();

  const { data, isLoading, isFetching } = useQuery(['admin-orders', params], () => api.getOrdersByAdmin(params), {
    keepPreviousData: true,
    onError: (error) => Swal.fire(error?.response?.data?.message || 'Something went wrong!', '', 'error')
  });

  const orders = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const columns = [
    {
      key: 'orderNo',
      label: 'Order',
      sortable: true,
      render: (order) => (
        <div className="min-w-[145px]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-bold text-slate-900">#{order.orderNo}</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              {sourceLabel(order)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {order.createdAt ? fDateTime(order.createdAt) : '—'}
          </div>
        </div>
      )
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (order) => {
        const phone = order.shippingAddress?.phone || order.user?.phone;
        return (
          <div className="min-w-[160px]">
            <div className="font-semibold text-slate-800">
              {order.shippingAddress?.name || order.user?.name || 'Guest customer'}
            </div>
            {phone ? (
              <Link
                href={`/users/${encodeURIComponent(phone)}`}
                className="mt-0.5 inline-block text-xs text-slate-500 transition hover:text-slate-800 hover:underline"
              >
                {phone}
              </Link>
            ) : (
              <span className="mt-0.5 block text-xs text-slate-400">No phone</span>
            )}
          </div>
        );
      }
    },
    {
      key: 'items',
      label: 'Items',
      align: 'center',
      render: (order) => <span className="font-semibold text-slate-700">{order.items?.length || 0}</span>
    },
    {
      key: 'createdBy',
      label: 'Created by',
      render: (order) => (
        <div className="min-w-[130px]">
          <div className="font-semibold text-slate-700">
            {order.createdBy?.name || (order.source === 'online' ? 'Customer' : 'Unknown')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {order.branch?.name || (order.source === 'admin' ? 'Contact center' : 'Online store')}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Fulfillment',
      sortable: true,
      render: (order) => (
        <div className="min-w-[135px]">
          <StatusBadge status={order.status} statuses={statuses} />
          <div className="mt-1.5 text-[11px] text-slate-400">Due {fmtDate(order.estimatedDelivery)}</div>
        </div>
      )
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (order) =>
        order.tags?.length ? <TagChips tags={order.tags} /> : <span className="text-slate-300">—</span>
    },
    {
      key: 'payment',
      label: 'Payment',
      render: (order) => (
        <div>
          <PaymentBadge status={order.paymentStatus} />
          <div className="mt-1.5 text-[11px] uppercase text-slate-400">{order.paymentMethod || 'Not set'}</div>
        </div>
      )
    },
    {
      key: 'total',
      label: 'Amount',
      sortable: true,
      align: 'right',
      render: (order) => <span className="whitespace-nowrap font-bold text-slate-900">{fmtMoney(order.total)}</span>
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (order) => (
        <button
          type="button"
          onClick={() => router.push(`/orders/${order.orderNo}`)}
          className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
          title="Open order"
          aria-label={`Open order ${order.orderNo}`}
        >
          <MdChevronRight size={20} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" subtitle={`${total} order${total !== 1 ? 's' : ''} in this view`}>
        <Link href="/orders/create" className="btn-brand">
          <BsCartPlus size={16} /> Create order
        </Link>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search order, customer or phone…"
        onReset={() => {
          setSearch('');
          setStatus('');
          setView('active');
          setSortBy('estimatedDelivery');
          setSortOrder('asc');
          setPage(1);
        }}
      >
        <select
          value={view}
          onChange={(event) => {
            setView(event.target.value);
            setStatus('');
            setPage(1);
          }}
          className="select-ui min-w-[140px] font-semibold"
          aria-label="Order visibility"
        >
          <option value="active">Open orders</option>
          <option value="all">All orders</option>
        </select>
        <StatusSelect
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          statuses={statuses}
          placeholder={view === 'active' ? 'All open statuses' : 'All statuses'}
          className="select-ui min-w-[155px]"
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        data={orders}
        sort={sort}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No orders found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="orders" />}
      />
    </div>
  );
}
