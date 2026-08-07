'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { useQuery, useQueryClient } from 'react-query';
import { BsCartPlus } from 'react-icons/bs';
import {
  MdChevronRight,
  MdDelete,
  MdInbox,
  MdLabel,
  MdLocalShipping,
  MdReceiptLong,
  MdSwapHoriz,
  MdTableRows,
  MdViewList
} from 'react-icons/md';

import * as api from 'src/services';
import { alertError, alertWarning, confirmDelete, promptSelect } from 'src/utils/swal';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import { printInvoices, printShippingLabels } from 'src/components/_admin/dispatch/openDocuments';
import DataTable from 'src/components/_admin/ui/DataTable';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { StatusBadge, StatusSelect } from 'src/components/_admin/shared/StatusBadge';
import { useStatuses } from 'src/components/_admin/shared/useStatuses';
import { fDate, fDateTime } from 'src/utils/formatTime';
import CompactOrdersTable from './CompactOrdersTable';

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
  const [tableView, setTableView] = useState('summary');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('estimatedDelivery');
  const [sortOrder, setSortOrder] = useState('asc');
  const limit = 20;

  const qc = useQueryClient();
  const settings = useSiteSettings();
  const { statuses } = useStatuses('order');
  const { statuses: itemStatuses } = useStatuses('orderItem');
  const { data: tagData } = useQuery('admin-order-tags', () => api.getOrderTagsByAdmin(''));
  const orderTags = tagData?.data || [];

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
    ...(tableView === 'compact' && { includeDetails: 'true' }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();

  const { data, isLoading, isFetching } = useQuery(['admin-orders', params], () => api.getOrdersByAdmin(params), {
    keepPreviousData: true,
    onError: (error) => alertError(error, { title: "Couldn't load orders" })
  });

  const orders = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const refreshOrders = () => qc.invalidateQueries(['admin-orders']);

  /**
   * Both documents are PDFs built from full orders, so each row is re-fetched
   * first — the list projection carries neither the address nor the payments
   * the collectable amount is derived from.
   *
   * Each resolves false so the selection survives: printing changes nothing
   * about the orders, and an operator usually prints invoices and labels for
   * the same batch, back to back. The dedicated print desk at /orders/print
   * does both from one selection.
   */
  const printDocuments = (task, failureTitle, missingNoun) => async (rows) => {
    try {
      const { skipped } = await task(rows, settings);
      if (skipped) {
        alertWarning(
          'Some orders were left out',
          `${skipped} order${skipped === 1 ? '' : 's'} could not be loaded, so ${skipped === 1 ? `its ${missingNoun} is` : `their ${missingNoun}s are`} missing.`
        );
      }
    } catch (error) {
      alertError(error, { title: failureTitle });
    }
    return false;
  };

  const printLabels = printDocuments(printShippingLabels, 'The label sheet could not be built', 'label');
  const printInvoicesFor = printDocuments(printInvoices, 'The invoices could not be built', 'invoice');

  // The chosen status/tag has to survive from the confirm step into the per-row
  // work, so each action stashes it here rather than re-prompting per order.
  let pendingStatus = null;
  let pendingTag = null;

  const bulkActions = [
    {
      label: 'Print invoices',
      icon: MdReceiptLong,
      tone: 'neutral',
      hint: 'One invoice per A4 page, as a PDF in a new tab',
      onClick: printInvoicesFor
    },
    {
      label: 'Print labels',
      icon: MdLocalShipping,
      tone: 'neutral',
      hint: 'Six shipping labels to an A4 sheet, as a PDF in a new tab',
      onClick: printLabels
    },
    {
      label: 'Change status',
      icon: MdSwapHoriz,
      tone: 'neutral',
      action: 'Moved',
      unit: 'orders',
      hint: 'Move every selected order to the same fulfillment status',
      confirm: async (rows) => {
        pendingStatus = await promptSelect({
          title: `Move ${rows.length} order${rows.length === 1 ? '' : 's'} to…`,
          text: 'Status changes notify the customer if an SMS template is enabled for the new status.',
          options: statuses.map((entry) => ({ value: entry.value, label: entry.label })),
          placeholder: 'Choose a status',
          confirmText: 'Move orders'
        });
        return Boolean(pendingStatus);
      },
      perform: (order) => api.updateOrderStatusByAdmin({ orderNo: order.orderNo, status: pendingStatus }),
      rowLabel: (order) => `#${order.orderNo}`,
      onSettled: refreshOrders
    },
    {
      label: 'Add tag',
      icon: MdLabel,
      tone: 'neutral',
      action: 'Tagged',
      unit: 'orders',
      hint: 'Add one tag to every selected order, keeping tags they already have',
      disabled: () => orderTags.length === 0,
      confirm: async (rows) => {
        pendingTag = await promptSelect({
          title: `Tag ${rows.length} order${rows.length === 1 ? '' : 's'}`,
          text: 'The tag is added alongside any tags these orders already carry.',
          options: orderTags.map((tag) => ({ value: tag.id, label: tag.name })),
          placeholder: 'Choose a tag',
          confirmText: 'Add tag'
        });
        return Boolean(pendingTag);
      },
      perform: (order) => {
        const existing = (order.tags || []).map((tag) => tag.id ?? tag);
        if (existing.some((id) => String(id) === String(pendingTag))) return Promise.resolve();
        return api.updateOrderStatus({ id: order.orderNo, tags: [...existing, pendingTag] });
      },
      rowLabel: (order) => `#${order.orderNo}`,
      onSettled: refreshOrders
    },
    {
      label: 'Delete',
      icon: MdDelete,
      tone: 'danger',
      action: 'Deleted',
      unit: 'orders',
      confirm: (rows) =>
        confirmDelete({
          count: rows.length,
          unit: 'orders',
          subject: rows.length === 1 ? `Order #${rows[0].orderNo}` : undefined,
          items: rows.map((order) => `#${order.orderNo} — ${order.shippingAddress?.name || 'Guest customer'}`),
          text: 'Reserved stock is released and the orders leave every report until restored.'
        }),
      perform: (order) => api.deleteOrderByAdmin(order.orderNo),
      rowLabel: (order) => `#${order.orderNo}`,
      onSettled: refreshOrders
    }
  ];

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
        right={
          <div className="inline-flex h-9 rounded-md border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Order table view">
            <button
              type="button"
              onClick={() => {
                setTableView('summary');
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] ${
                tableView === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              aria-pressed={tableView === 'summary'}
            >
              <MdViewList size={17} /> Summary
            </button>
            <button
              type="button"
              onClick={() => {
                setTableView('compact');
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] ${
                tableView === 'compact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              aria-pressed={tableView === 'compact'}
            >
              <MdTableRows size={16} /> Compact details
            </button>
          </div>
        }
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

      {tableView === 'compact' ? (
        <CompactOrdersTable
          orders={orders}
          statuses={statuses}
          itemStatuses={itemStatuses}
          isLoading={isLoading || isFetching}
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={setPage}
          sort={sort}
          // The same actions and the same CSV shape as the summary view — the
          // view you are in should not change what you can do with a selection.
          columns={columns}
          bulkActions={bulkActions}
          selectionLabel="orders"
          exportFileName="orders-selection.csv"
        />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          sort={sort}
          rowKey={(order) => order.orderNo}
          selectionLabel="orders"
          exportFileName="orders-selection.csv"
          bulkActions={bulkActions}
          isLoading={isLoading || isFetching}
          empty={<EmptyState title="No orders found" icon={MdInbox} />}
          footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="orders" />}
        />
      )}
    </div>
  );
}
