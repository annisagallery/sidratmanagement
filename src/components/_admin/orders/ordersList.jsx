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
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Segmented from 'src/components/_admin/ui/Segmented';
import Badge from 'src/components/_admin/ui/Badge';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';
import { StatusBadge, StatusSelect, TagChips } from 'src/components/_admin/shared/StatusBadge';
import { useStatuses } from 'src/components/_admin/shared/useStatuses';
import { fDate, fDateTime } from 'src/utils/formatTime';
import CompactOrdersTable from './CompactOrdersTable';

const PAYMENT_TONE = { paid: 'success', unpaid: 'neutral', refunded: 'warning' };

function PaymentBadge({ status }) {
  return (
    <Badge tone={PAYMENT_TONE[status] || (String(status).startsWith('pending') ? 'warning' : 'neutral')} dot>
      {status ? String(status).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—'}
    </Badge>
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

  // This page is the fulfillment queue only; counter sales stay outside this channel.
  const params = new URLSearchParams({
    page,
    limit,
    channel: 'orders',
    ...(search && { search }),
    ...(status ? { status } : { view }),
    ...(tableView === 'compact' && { includeDetails: 'true' }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery(
    ['admin-orders', params],
    () => api.getOrdersByAdmin(params),
    { keepPreviousData: true }
  );
  const filtered = Boolean(search || status || view !== 'active');

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
            <span className="font-mono text-[13px] font-semibold text-slate-900">#{order.orderNo}</span>
            <Badge>{sourceLabel(order)}</Badge>
          </div>
          <div className="mt-1 text-xs text-slate-500">
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
            <div className="font-medium text-slate-900">
              {order.shippingAddress?.name || order.user?.name || 'Guest customer'}
            </div>
            {phone ? (
              <Link
                href={`/users/${encodeURIComponent(phone)}`}
                onClick={stopRow}
                className="mt-0.5 inline-block text-xs text-slate-500 transition hover:text-slate-800 hover:underline"
              >
                {phone}
              </Link>
            ) : (
              <span className="mt-0.5 block text-xs text-slate-500">No phone</span>
            )}
          </div>
        );
      }
    },
    {
      key: 'items',
      label: 'Items',
      align: 'center',
      hideBelow: 'lg',
      render: (order) => <span className="font-medium tabular-nums text-slate-700">{order.items?.length || 0}</span>
    },
    {
      key: 'createdBy',
      label: 'Created by',
      hideBelow: 'xl',
      render: (order) => (
        <div className="min-w-[130px]">
          <div className="font-medium text-slate-700">
            {order.createdBy?.name || (order.source === 'online' ? 'Customer' : 'Unknown')}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
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
          <div className="mt-1.5 text-xs text-slate-500">Due {fmtDate(order.estimatedDelivery)}</div>
        </div>
      )
    },
    {
      key: 'tags',
      label: 'Tags',
      hideBelow: 'xl',
      render: (order) =>
        order.tags?.length ? <TagChips tags={order.tags} /> : <span className="text-slate-400">—</span>
    },
    {
      key: 'payment',
      label: 'Payment',
      hideBelow: 'md',
      render: (order) => (
        <div>
          <PaymentBadge status={order.paymentStatus} />
          <div className="mt-1.5 text-xs uppercase text-slate-500">{order.paymentMethod || 'Not set'}</div>
        </div>
      )
    },
    {
      key: 'total',
      label: 'Amount',
      sortable: true,
      align: 'right',
      render: (order) => <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{fmtMoney(order.total)}</span>
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Open',
      align: 'right',
      render: () => <MdChevronRight size={20} className="text-slate-300" aria-hidden />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" subtitle={`${total} order${total !== 1 ? 's' : ''} in this view`}>
        <Link href="/orders/create" target="_blank" rel="noopener" title="Opens the order desk in a new tab" className="btn-brand">
          <BsCartPlus size={16} aria-hidden /> Create order
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
          <Segmented
            label="Order table view"
            options={[
              { id: 'summary', label: 'Summary', icon: MdViewList },
              { id: 'compact', label: 'Compact details', icon: MdTableRows }
            ]}
            value={tableView}
            onChange={(id) => {
              setTableView(id);
              setPage(1);
            }}
          />
        }
      >
        <select
          value={view}
          onChange={(event) => {
            setView(event.target.value);
            setStatus('');
            setPage(1);
          }}
          className="select-ui min-w-[140px]"
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
          aria-label="Fulfillment status"
        />
      </ListToolbar>

      {isError && !data ? (
        <ErrorState error={error} title="Orders could not be loaded" onRetry={refetch} />
      ) : tableView === 'compact' ? (
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
          isLoading={isLoading}
          isFetching={isFetching}
          caption="Orders"
          onRowClick={(order) => router.push(`/orders/${order.orderNo}`)}
          rowLabel={(order) => `Open order ${order.orderNo}`}
          empty={
            <EmptyState
              title={filtered ? 'No orders match these filters' : 'No open orders'}
              icon={MdInbox}
              action={
                filtered ? null : (
                  <Link href="/orders/create" target="_blank" rel="noopener" title="Opens the order desk in a new tab" className="btn-brand">
                    <BsCartPlus size={16} aria-hidden /> Create order
                  </Link>
                )
              }
            />
          }
          footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="orders" />}
        />
      )}
    </div>
  );
}
