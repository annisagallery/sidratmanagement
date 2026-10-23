'use client';

import { useRef, useState } from 'react';
import { orderChannelLabel } from 'src/utils/orderChannel';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { useQuery, useQueryClient } from 'react-query';
import { BsCartPlus } from 'react-icons/bs';
import {
  MdChevronRight,
  MdDelete,
  MdInbox,
  MdExpandMore,
  MdFilterAltOff,
  MdTune,
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
import { fDateTime } from 'src/utils/formatTime';
import CompactOrdersTable from './CompactOrdersTable';
import OrderSignals, { OrderReadiness, orderRowTone } from './OrderSignals';

const PAYMENT_TONE = { paid: 'success', unpaid: 'neutral', refunded: 'warning' };

function PaymentBadge({ status }) {
  return (
    <Badge tone={PAYMENT_TONE[status] || (String(status).startsWith('pending') ? 'warning' : 'neutral')} dot>
      {status ? String(status).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—'}
    </Badge>
  );
}



const fmtMoney = (amount) =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(amount || 0);

const sourceLabel = orderChannelLabel;

export default function OrderList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchState, setSearchState] = useState({ url: urlSearch, text: urlSearch });
  if (searchState.url !== urlSearch) setSearchState({ url: urlSearch, text: urlSearch });
  const search = searchState.url === urlSearch ? searchState.text : urlSearch;
  const setSearch = (text) => setSearchState({ url: urlSearch, text });
  const status = searchParams.get('status') || '';
  const view = searchParams.get('view') || 'active';
  const tableView = searchParams.get('tableView') || 'summary';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const sortBy = searchParams.get('sortBy') || 'estimatedDelivery';
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const channel = ['online', 'admin', 'branch'].includes(searchParams.get('channel')) ? searchParams.get('channel') : 'orders';
  const channelBranch = searchParams.get('channelBranch') || '';
  const paymentStatus = searchParams.get('paymentStatus') || '';
  const dateField = searchParams.get('dateField') || 'createdAt';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const preset = searchParams.get('preset') || '';
  const tag = searchParams.get('tag') || '';
  const deliveryType = searchParams.get('deliveryType') || '';
  const courier = searchParams.get('courier') || '';
  const createdBy = searchParams.get('createdBy') || '';
  const moreFilterCount = [from || to, tag, deliveryType, courier, createdBy].filter(Boolean).length;
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(Boolean(moreFilterCount));
  const limit = 20;
  const patchFilters = (patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('branch');
    if (resetPage) next.delete('page');
    Object.entries(patch).forEach(([key, value]) => {
      if (value === '' || value == null) next.delete(key);
      else next.set(key, String(value));
    });
    router.replace('/orders' + (next.size ? '?' + next.toString() : ''), { scroll: false });
  };
  const setPage = (value) => patchFilters({ page: value }, { resetPage: false });

  const qc = useQueryClient();
  const settings = useSiteSettings();
  const { statuses } = useStatuses('order');
  const { statuses: itemStatuses } = useStatuses('orderItem');
  const { data: tagData } = useQuery('admin-order-tags', () => api.getOrderTagsByAdmin(''));
  const orderTags = tagData?.data || [];

  const optionsQuery = useQuery('order-filter-options', api.getOrderFilterOptions);
  const branches = optionsQuery.data?.data?.branches || [];
  const staff = optionsQuery.data?.data?.staff || [];
  const handleSort = (field) => patchFilters({ sortBy: field, sortOrder: sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc' });
  const params = new URLSearchParams({
    page, limit, channel, view, sortBy, sortOrder,
    ...(urlSearch && { search: urlSearch }), ...(status && { status }),
    ...(channel === 'branch' && { channelBranch }),
    ...(paymentStatus && { paymentStatus }), ...(from && { from }), ...(to && { to }), dateField,
    ...(preset && { preset }), ...(tag && { tag }), ...(deliveryType && { deliveryType }),
    ...(courier && { courier }), ...(createdBy && { createdBy }),
    ...(tableView === 'compact' && { includeDetails: 'true' })
  }).toString();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery(
    ['admin-orders', params],
    () => api.getOrdersByAdmin(params),
    { keepPreviousData: true, refetchInterval: 60000 }
  );
  const filtered = Boolean(urlSearch || status || view !== 'active' || channel !== 'orders' || paymentStatus || from || to || preset || tag || deliveryType || courier || createdBy);

  const orders = data?.data || [];
  const shortcutCounts = data?.shortcutCounts;
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
  const pendingStatus = useRef(null);
  const pendingTag = useRef(null);

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
        pendingStatus.current = await promptSelect({
          title: `Move ${rows.length} order${rows.length === 1 ? '' : 's'} to…`,
          text: 'Status changes notify the customer if an SMS template is enabled for the new status.',
          options: statuses.map((entry) => ({ value: entry.value, label: entry.label })),
          placeholder: 'Choose a status',
          confirmText: 'Move orders'
        });
        return Boolean(pendingStatus.current);
      },
      perform: (order) => api.updateOrderStatusByAdmin({ orderNo: order.orderNo, status: pendingStatus.current }),
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
        pendingTag.current = await promptSelect({
          title: `Tag ${rows.length} order${rows.length === 1 ? '' : 's'}`,
          text: 'The tag is added alongside any tags these orders already carry.',
          options: orderTags.map((tag) => ({ value: tag.id, label: tag.name })),
          placeholder: 'Choose a tag',
          confirmText: 'Add tag'
        });
        return Boolean(pendingTag.current);
      },
      perform: (order) => {
        const existing = (order.tags || []).map((tag) => tag.id ?? tag);
        if (existing.some((id) => String(id) === String(pendingTag.current))) return Promise.resolve();
        return api.updateOrderStatus({ id: order.orderNo, tags: [...existing, pendingTag.current] });
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
      label: 'Products',
      align: 'center',
      hideBelow: 'lg',
      render: (order) => <OrderReadiness order={order} />
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
          <OrderSignals order={order} />
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

      <section className="card-ui overflow-hidden" aria-label="Order search and filters">
        <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
      <ListToolbar
        searchClassName="sm:max-w-xl"
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => patchFilters({ search })}
        searchPlaceholder="Search order, customer or phone…"
        onRefresh={refetch}
        refreshing={isFetching}
        right={
          <Segmented
            label="Order table view"
            options={[
              { id: 'summary', label: 'Summary', icon: MdViewList },
              { id: 'compact', label: 'Detailed', icon: MdTableRows }
            ]}
            value={tableView}
            onChange={(id) => {
              patchFilters({ tableView: id });
            }}
          />
        }
      />
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-[1.4fr_.9fr_1fr_1.1fr]">
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-slate-600">
          Channel
          <select className="select-ui w-full min-w-0" value={channel === 'branch' ? 'branch:' + channelBranch : channel} onChange={(e) => {
            const value = e.target.value;
            patchFilters(value.startsWith('branch:') ? { channel: 'branch', channelBranch: value.slice(7) } : { channel: value, channelBranch: '' });
          }}>
            <option value="orders">All order channels</option>
            <option value="online">00 - Website</option>
            <option value="admin">01 - Contact center</option>
            {branches.map((b) => <option key={b.id} value={'branch:' + b.id}>{b.orderChannelCode ? b.orderChannelCode + ' - ' : ''}{b.name}{b.deletedAt ? ' (archived)' : ''}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-slate-600">
          Orders
          <select className="select-ui w-full min-w-0" value={view} onChange={(e) => patchFilters({ view: e.target.value, status: '', preset: '' })}>
            <option value="active">Open orders</option><option value="all">All orders</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-slate-600">
          Fulfilment status
          <StatusSelect value={status} onChange={(e) => patchFilters({ status: e.target.value, preset: '' })} statuses={statuses} placeholder="All statuses" className="select-ui w-full min-w-0" />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-slate-600">
          Payment
          <select className="select-ui w-full min-w-0" value={paymentStatus} onChange={(e) => patchFilters({ paymentStatus: e.target.value, preset: preset === 'unpaid' ? '' : preset })}>
            <option value="">Any payment status</option><option value="unpaid">Unpaid / balance due</option>
            <option value="pending_verification">Pending verification</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
          </select>
        </label>
        </div>
        {optionsQuery.isError && <p role="alert" className="px-4 pb-3 text-sm text-rose-700 sm:px-5">Channel and staff filters could not be loaded. <button type="button" className="underline" onClick={() => optionsQuery.refetch()}>Retry</button></p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-1" aria-label="Order shortcuts">
            {[['', 'All open'], ['overdue', 'Overdue'], ['due-today', 'Due today'], ['due-soon', 'Due soon'], ['ready', 'Products ready'], ['unpaid', 'Payment pending']].map(([id, label]) => {
              const active = preset === id && (id !== '' || (view === 'active' && !status));
              const tone = id === 'overdue' ? 'text-rose-800 hover:bg-rose-100' : ['due-today', 'due-soon'].includes(id) ? 'text-amber-800 hover:bg-amber-100' : id === 'ready' ? 'text-emerald-800 hover:bg-emerald-100' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900';
              const dot = id === 'overdue' ? 'bg-rose-500' : ['due-today', 'due-soon'].includes(id) ? 'bg-amber-500' : id === 'ready' ? 'bg-emerald-500' : '';
              const count = shortcutCounts?.[id || 'all'];
              return <button key={id} type="button" aria-pressed={active} title={id === 'due-soon' ? 'Due in the next two days, excluding today (Bangladesh time)' : undefined} className={'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ' + (active ? 'bg-slate-900 text-white shadow-sm' : tone)} onClick={() => patchFilters({ preset: id, status: '', view: 'active', paymentStatus: id === 'unpaid' ? '' : paymentStatus })}>
                {dot && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : dot}`} />}
                {label}
                <span className={`min-w-6 rounded px-1.5 py-0.5 text-center text-xs tabular-nums ${active ? 'bg-white/15 text-white' : 'bg-slate-200/70 text-slate-700'} ${isFetching ? 'opacity-60' : ''}`}>
                  {count == null ? '—' : Number(count).toLocaleString()}
                </span>
              </button>;
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => { setSearch(''); router.replace('/orders', { scroll: false }); }} className="btn-quiet btn-sm gap-1.5">
              <MdFilterAltOff size={15} aria-hidden /> Clear filters
            </button>
            <span className="h-5 w-px bg-slate-200" aria-hidden />
            <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" aria-expanded={moreFiltersOpen} aria-controls="order-additional-filters" onClick={() => setMoreFiltersOpen((open) => !open)}>
              <MdTune size={16} aria-hidden /> More filters
              {moreFilterCount > 0 && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-700">{moreFilterCount}</span>}
              <MdExpandMore size={17} className={moreFiltersOpen ? 'rotate-180' : ''} aria-hidden />
            </button>
          </div>
        </div>
        <div id="order-additional-filters" hidden={!moreFiltersOpen} className="border-t border-slate-200 px-4 py-4 sm:px-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&_label]:min-w-0 [&_select]:w-full">
          <label className="grid gap-1 text-xs font-medium text-slate-600">Date type<select className="select-ui" value={dateField} onChange={(e) => patchFilters({ dateField: e.target.value })}><option value="createdAt">Created date</option><option value="estimatedDelivery">Promised delivery date</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">From<input type="date" className="input-ui" value={from} max={to || undefined} onChange={(e) => patchFilters({ from: e.target.value })} /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">To<input type="date" className="input-ui" value={to} min={from || undefined} onChange={(e) => patchFilters({ to: e.target.value })} /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Created by<select className="select-ui" value={createdBy} onChange={(e) => patchFilters({ createdBy: e.target.value })}><option value="">Any staff member</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Tag<select className="select-ui" value={tag} onChange={(e) => patchFilters({ tag: e.target.value })}><option value="">Any tag</option>{orderTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Delivery type<select className="select-ui" value={deliveryType} onChange={(e) => patchFilters({ deliveryType: e.target.value })}><option value="">Any delivery type</option><option value="regular">Regular</option><option value="urgent">Urgent</option><option value="sameDay">Same day</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Courier<select className="select-ui" value={courier} onChange={(e) => patchFilters({ courier: e.target.value })}><option value="">Any courier</option><option value="pathao">Pathao</option><option value="steadfast">Steadfast</option><option value="carrybee">CarryBee</option></select></label>
        </div>
        <p className="mt-3 text-xs text-slate-500">Date ranges include the whole day in Bangladesh time.</p>
        </div>
      </section>


      {isError ? (
        <ErrorState error={error} title="Orders could not be loaded" onRetry={refetch} />
      ) : tableView === 'compact' ? (
        <CompactOrdersTable
          orders={orders}
          statuses={statuses}
          itemStatuses={itemStatuses}
          isLoading={isLoading}
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
          rowClassName={orderRowTone}
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
