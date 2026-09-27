'use client';
import { useRouter } from 'next-nprogress-bar';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Link from 'next/link';
import * as api from 'src/services';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { alertError, confirmAction, confirmDelete, toastSuccess } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import Drawer from 'src/components/_admin/ui/Drawer';
import Badge, { RecordStatus } from 'src/components/_admin/ui/Badge';
import { KpiGrid, StatTile } from 'src/components/_admin/ui/kpi';
import { EmptyState, ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';
import { MdAdd, MdDelete, MdInbox, MdBarChart, MdBlock, MdCheckCircle, MdEdit } from 'react-icons/md';
import { fDate } from 'src/utils/formatTime';

const BDT = '৳';
const money = (n) => `${BDT}${Number(n || 0).toLocaleString()}`;

const STATUS_OPTS = [
  { label: 'Any status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
];
const TYPE_OPTS = [
  { label: 'Any discount type', value: '' },
  { label: 'Percentage', value: 'percent' },
  { label: 'Fixed amount', value: 'fixed' }
];

const ORDER_TONE = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'violet',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'warning'
};

function fmtDate(d) {
  if (!d) return '—';
  return fDate(d);
}

const label = (value) => (value ? String(value).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—');

function ApplyBadge({ applyTo }) {
  if (!applyTo) return <span className="text-slate-400">—</span>;
  return <Badge tone={applyTo === 'shipping' ? 'info' : 'violet'}>{applyTo === 'shipping' ? 'Shipping' : 'Products'}</Badge>;
}

// ── Usage statistics drawer ───────────────────────────────────────────────────
function UsageDrawer({ coupon, onClose }) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery(
    ['coupon-usage', coupon.id, page],
    () => api.getCouponUsageByAdmin(coupon.id, page),
    { keepPreviousData: true }
  );

  const usages = data?.data || [];
  const totalPages = data?.count || 1;
  const total = data?.total || 0;
  const stats = data?.stats || {};

  return (
    <Drawer
      title={
        <span className="flex items-center gap-2">
          <span className="code-chip">{coupon.code}</span>
          {coupon.isAffiliate && <Badge tone="violet">Affiliate</Badge>}
        </span>
      }
      subtitle={`${coupon.name} · ${total} use${total !== 1 ? 's' : ''}`}
      eyebrow="Coupon usage"
      size="lg"
      onClose={onClose}
    >
      <div className="space-y-6">
        <KpiGrid columns={coupon.isAffiliate ? 3 : 2}>
          <StatTile size="sm" label="Uses" value={(stats.totalUses || 0).toLocaleString()} loading={isLoading} />
          <StatTile size="sm" label="Customers" value={(stats.uniqueUsers || 0).toLocaleString()} loading={isLoading} />
          <StatTile size="sm" label="Discount given" value={money(stats.totalDiscount)} loading={isLoading} />
          <StatTile size="sm" label="Order value" value={money(stats.totalOrderValue)} loading={isLoading} />
          {coupon.isAffiliate && (
            <>
              <StatTile size="sm" label="Commission earned" value={money(stats.totalCommission)} loading={isLoading} />
              <StatTile size="sm" label="Commission unpaid" value={money(stats.unpaidCommission)} loading={isLoading} />
            </>
          )}
        </KpiGrid>

        <section aria-labelledby="usage-history-title" className="space-y-3">
          <h3 id="usage-history-title" className="text-sm font-semibold text-slate-900">
            Usage history
          </h3>
          {isLoading ? (
            <LoadingBlock rows={5} />
          ) : isError ? (
            <ErrorState error={error} title="Usage could not be loaded" onRetry={refetch} />
          ) : usages.length === 0 ? (
            <div className="card-ui">
              <EmptyState compact icon={MdBarChart} title="Not used yet" hint="Orders that use this code appear here." />
            </div>
          ) : (
            <div className="card-ui overflow-hidden">
              <GlobalTable>
                <caption className="sr-only">Orders that used {coupon.code}</caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Order</th>
                    <th scope="col" className="hidden text-right sm:table-cell">
                      Order total
                    </th>
                    <th scope="col" className="text-right">
                      Discount
                    </th>
                    {coupon.isAffiliate && (
                      <th scope="col" className="text-right">
                        Commission
                      </th>
                    )}
                    <th scope="col" className="hidden md:table-cell">
                      Date
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usages.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.user?.phone ? (
                          <Link href={`/users/${encodeURIComponent(u.user.phone)}`} className="group block">
                            <span className="block text-[13px] font-medium text-slate-900 group-hover:underline">{u.user.name || '—'}</span>
                            <span className="block text-xs text-slate-500">{u.user.phone}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        {u.order?.orderNo ? (
                          <Link href={`/orders/${u.order.orderNo}`} className="ops-code text-[13px] text-slate-900 hover:underline">
                            #{u.order.orderNo}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="hidden text-right tabular-nums text-slate-700 sm:table-cell">{money(u.orderTotal)}</td>
                      <td className="text-right font-semibold tabular-nums text-emerald-700">−{money(u.discountAmount)}</td>
                      {coupon.isAffiliate && (
                        <td className="text-right">
                          <span className="tabular-nums text-slate-900">{money(u.commissionAmount)}</span>
                          <span className="block text-xs text-slate-500">{u.commissionPaid ? 'Paid' : 'Unpaid'}</span>
                        </td>
                      )}
                      <td className="hidden whitespace-nowrap text-slate-600 md:table-cell">{fmtDate(u.createdAt)}</td>
                      <td>
                        {u.order?.status ? (
                          <Badge tone={ORDER_TONE[u.order.status] || 'neutral'} dot>
                            {label(u.order.status)}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </GlobalTable>
              <Pagination page={page} totalPages={totalPages} total={total} unit="uses" onPage={setPage} />
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────
export default function CouponList() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [statsFor, setStatsFor] = useState(null); // coupon object to show drawer for

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const { data, isLoading, isFetching, isError, error: loadError, refetch } = useQuery(
    ['admin-coupons', page, search, status, type, sortBy, sortOrder],
    () => api.getCouponCodesByAdmin(page, search, status, type, sortBy, sortOrder),
    { keepPreviousData: true }
  );

  const { mutate: deleteMut } = useMutation(api.deleteCouponCodeByAdmin, {
    onSuccess: () => {
      toastSuccess('Coupon deleted');
      qc.invalidateQueries('admin-coupons');
    },
    onError: (error) => alertError(error, { title: "Couldn't delete that coupon" })
  });

  const handleDelete = async (coupon) => {
    const confirmed = await confirmDelete({
      subject: coupon.code,
      text: 'Shoppers who try the code get "not valid". Orders that already used it keep their discount.'
    });
    if (confirmed) deleteMut(coupon.id);
  };

  const refreshCoupons = () => qc.invalidateQueries('admin-coupons');

  const setCouponStatus = (couponStatus) => (coupon) =>
    api.updateCouponCodeByAdmin({ currentId: coupon.id, status: couponStatus });

  const bulkActions = [
    {
      label: 'Enable',
      icon: MdCheckCircle,
      tone: 'success',
      action: 'Enabled',
      unit: 'coupons',
      confirm: (rows) =>
        confirmAction({
          tone: 'success',
          title: `Enable ${rows.length} coupon${rows.length === 1 ? '' : 's'}?`,
          text: 'Shoppers can redeem them at checkout, subject to each coupon’s own limits and dates.',
          confirmText: 'Enable'
        }),
      perform: setCouponStatus('active'),
      rowLabel: (coupon) => coupon.code,
      onSettled: refreshCoupons
    },
    {
      label: 'Disable',
      icon: MdBlock,
      tone: 'warning',
      action: 'Disabled',
      unit: 'coupons',
      confirm: (rows) =>
        confirmAction({
          tone: 'warning',
          title: `Disable ${rows.length} coupon${rows.length === 1 ? '' : 's'}?`,
          text: 'The codes stop working at checkout right away. Nothing already redeemed is affected.',
          items: rows.map((coupon) => coupon.code),
          confirmText: 'Disable'
        }),
      perform: setCouponStatus('inactive'),
      rowLabel: (coupon) => coupon.code,
      onSettled: refreshCoupons
    },
    {
      label: 'Delete',
      icon: MdDelete,
      tone: 'danger',
      action: 'Deleted',
      unit: 'coupons',
      confirm: (rows) =>
        confirmDelete({
          count: rows.length,
          unit: 'coupons',
          subject: rows.length === 1 ? rows[0].code : undefined,
          items: rows.map((coupon) => coupon.code),
          text: 'Orders that already used these codes keep their discount.'
        }),
      perform: (coupon) => api.deleteCouponCodeByAdmin(coupon.id),
      rowLabel: (coupon) => coupon.code,
      onSettled: refreshCoupons
    }
  ];

  const coupons = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;
  const sort = { by: sortBy, order: sortOrder, onSort: handleSort };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      render: (c) => (
        <>
          <span className="code-chip">{c.code}</span>
          {c.isAffiliate && (
            <Badge tone="violet" className="ml-1.5">
              Affiliate
            </Badge>
          )}
        </>
      )
    },
    { key: 'name', label: 'Name', sortable: true, hideBelow: 'md', render: (c) => <span className="text-slate-700">{c.name}</span> },
    {
      key: 'discount',
      label: 'Discount',
      sortable: true,
      render: (c) => (
        <>
          <span className="font-semibold tabular-nums text-slate-900">
            {c.type === 'percent' ? `${c.discount}%` : money(c.discount)}
          </span>
          <span className="ml-1 text-xs text-slate-500">off</span>
        </>
      )
    },
    { key: 'applyTo', label: 'Applies to', hideBelow: 'lg', render: (c) => <ApplyBadge applyTo={c.applyTo} /> },
    {
      key: 'minPurchase',
      label: 'Minimum order',
      sortable: true,
      align: 'right',
      hideBelow: 'xl',
      render: (c) => <span className="tabular-nums text-slate-600">{c.minPurchase > 0 ? money(c.minPurchase) : '—'}</span>
    },
    {
      key: 'uses',
      label: 'Uses',
      align: 'right',
      render: (c) => (
        <button
          type="button"
          onClick={(e) => {
            stopRow(e);
            setStatsFor(c);
          }}
          className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums text-slate-900 underline-offset-2 hover:underline"
          title="Usage statistics"
          aria-label={`${c.usedBy?.length || 0} uses of ${c.code} — open usage statistics`}
        >
          {c.usedBy?.length || 0}
          {c.maxUses > 0 && <span className="font-normal text-slate-500"> / {c.maxUses}</span>}
          <MdBarChart size={15} className="text-slate-400" aria-hidden />
        </button>
      )
    },
    {
      key: 'expire',
      label: 'Expires',
      sortable: true,
      hideBelow: 'md',
      render: (c) => <span className="whitespace-nowrap text-slate-600">{c.expire ? fmtDate(c.expire) : 'Never'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (c) => <RecordStatus status={c.status} />
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={stopRow}>
          <Link href={`/coupon-codes/${c.id}`} className="btn-ghost btn-sm">
            Edit
          </Link>
          <ActionMenu
            label={`More actions for ${c.code}`}
            items={[
              { label: 'Edit', icon: MdEdit, onClick: () => router.push(`/coupon-codes/${c.id}`) },
              { label: 'Usage statistics', icon: MdBarChart, onClick: () => setStatsFor(c) },
              c.isAffiliate
                ? { label: 'Delete — managed in Affiliates (HRM)', icon: MdDelete, disabled: true }
                : { label: 'Delete', icon: MdDelete, tone: 'danger', onClick: () => handleDelete(c) }
            ]}
          />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {statsFor && <UsageDrawer coupon={statsFor} onClose={() => setStatsFor(null)} />}

      <PageHeader title="Coupons" subtitle={`${total} coupon${total !== 1 ? 's' : ''}`}>
        <Link href="/coupon-codes/add" className="btn-brand">
          <MdAdd size={18} aria-hidden /> New coupon
        </Link>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search by code or name…"
        onReset={
          search || status || type || sortBy
            ? () => {
                setSearch('');
                setStatus('');
                setType('');
                setSortBy('');
                setPage(1);
              }
            : undefined
        }
      >
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[130px]"
          aria-label="Status"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[120px]"
          aria-label="Discount type"
        >
          {TYPE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        caption="Coupons"
        onRowClick={(c) => router.push(`/coupon-codes/${c.id}`)}
        rowLabel={(c) => `Edit coupon ${c.code}`}
        error={isError ? loadError : null}
        onRetry={refetch}
        columns={columns}
        data={coupons}
        sort={sort}
        selectionLabel="coupons"
        exportFileName="coupons-selection.csv"
        bulkActions={bulkActions}
        isLoading={isLoading}
        isFetching={isFetching}
        empty={
          search || status || type ? (
            <EmptyState title="No coupons match" hint="Try another filter or clear the search." icon={MdInbox} />
          ) : (
            <EmptyState
              title="No coupons yet"
              hint="Create a code customers can enter at checkout."
              icon={MdInbox}
              action={
                <Link href="/coupon-codes/add" className="btn-brand">
                  <MdAdd size={18} aria-hidden /> New coupon
                </Link>
              }
            />
          )
        }
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="coupons" />}
      />
    </div>
  );
}
