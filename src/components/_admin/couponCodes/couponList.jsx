'use client';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import Link from 'next/link';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdInbox,
  MdBarChart,
  MdClose,
  MdPeople,
  MdDiscount,
  MdShoppingCart,
  MdLink
} from 'react-icons/md';
import { fDate } from 'src/utils/formatTime';

const BDT = '৳';

const STATUS_OPTS = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
];
const TYPE_OPTS = [
  { label: 'All Types', value: '' },
  { label: 'Percent', value: 'percent' },
  { label: 'Fixed', value: 'fixed' }
];

function fmtDate(d) {
  if (!d) return '—';
  return fDate(d);
}

function StatusBadge({ status }) {
  const map = { active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-500' };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}

function ApplyBadge({ applyTo }) {
  const map = { shipping: 'bg-blue-100 text-blue-700', product: 'bg-purple-100 text-purple-700' };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium capitalize ${map[applyTo] || 'bg-gray-100 text-gray-600'}`}
    >
      {applyTo || '—'}
    </span>
  );
}

// ── Usage Stats Drawer ────────────────────────────────────────────────────────
function UsageDrawer({ coupon, onClose }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(
    ['coupon-usage', coupon._id, page],
    () => api.getCouponUsageByAdmin(coupon._id, page),
    { keepPreviousData: true }
  );

  const usages = data?.data || [];
  const totalPages = data?.count || 1;
  const total = data?.total || 0;
  const stats = data?.stats || {};

  const statCards = [
    { icon: MdShoppingCart, label: 'Total Uses', value: stats.totalUses || 0, cls: 'text-blue-600', bg: 'bg-blue-50' },
    {
      icon: MdPeople,
      label: 'Unique Users',
      value: stats.uniqueUsers || 0,
      cls: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      icon: MdDiscount,
      label: 'Total Discount',
      value: `${BDT}${(stats.totalDiscount || 0).toLocaleString()}`,
      cls: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      icon: MdShoppingCart,
      label: 'Order Volume',
      value: `${BDT}${(stats.totalOrderValue || 0).toLocaleString()}`,
      cls: 'text-gray-700',
      bg: 'bg-gray-100'
    },
    ...(coupon.isAffiliate
      ? [
          {
            icon: MdLink,
            label: 'Commission Earned',
            value: `${BDT}${(stats.totalCommission || 0).toLocaleString()}`,
            cls: 'text-amber-600',
            bg: 'bg-amber-50'
          },
          {
            icon: MdLink,
            label: 'Commission Unpaid',
            value: `${BDT}${(stats.unpaidCommission || 0).toLocaleString()}`,
            cls: 'text-red-500',
            bg: 'bg-red-50'
          }
        ]
      : [])
  ];

  const ORDER_STATUS_CLS = {
    pending: 'bg-amber-50 text-amber-700',
    confirmed: 'bg-blue-50 text-blue-700',
    processing: 'bg-purple-50 text-purple-700',
    shipped: 'bg-cyan-50 text-cyan-700',
    delivered: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-500',
    returned: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black tracking-widest text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-sm">
                {coupon.code}
              </span>
              {coupon.isAffiliate && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-semibold">
                  Affiliate
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {coupon.name} · {total} use{total !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
          >
            <MdClose size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Stat cards */}
          {isLoading ? (
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-md animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {statCards.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className={`${s.bg} rounded-md p-4`}>
                    <Icon size={18} className={`${s.cls} mb-1.5`} />
                    <p className={`text-lg font-bold leading-none ${s.cls}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Usage table */}
          <div className="px-5 pb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Usage History</p>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-md animate-pulse" />
                ))}
              </div>
            ) : usages.length === 0 ? (
              <div className="text-center py-14 text-gray-400 border rounded-md">
                <MdBarChart size={36} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No uses yet</p>
              </div>
            ) : (
              <>
                <div className="border rounded-md overflow-hidden">
                  <DataTable className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">User</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Order</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Order Total</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Discount</th>
                        {coupon.isAffiliate && (
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Commission</th>
                        )}
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500">Date</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {usages.map((u) => (
                        <tr key={u._id} className="hover:bg-gray-50/60 transition">
                          <td className="px-4 py-2.5">
                            {u.user?.phone ? (
                              <a href={`/users/${encodeURIComponent(u.user.phone)}`} className="group">
                                <p className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition">
                                  {u.user.name || '—'}
                                </p>
                                <p className="text-xs text-gray-400 group-hover:text-blue-400 transition">
                                  {u.user.phone}
                                </p>
                              </a>
                            ) : (
                              <p className="text-xs text-gray-400">—</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs text-gray-700">{u.order?.orderNo || '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-gray-700">
                            {BDT}
                            {(u.orderTotal || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-green-700">
                            -{BDT}
                            {(u.discountAmount || 0).toLocaleString()}
                          </td>
                          {coupon.isAffiliate && (
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-xs font-semibold text-amber-700">
                                {BDT}
                                {(u.commissionAmount || 0).toLocaleString()}
                              </span>
                              {u.commissionPaid ? (
                                <span className="ml-1 text-xs text-green-600">✓</span>
                              ) : (
                                <span className="ml-1 text-xs text-gray-400">○</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-center text-xs text-gray-500">{fmtDate(u.createdAt)}</td>
                          <td className="px-4 py-2.5 text-center">
                            {u.order?.status ? (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-md capitalize font-medium ${ORDER_STATUS_CLS[u.order.status] || 'bg-gray-50 text-gray-600'}`}
                              >
                                {u.order.status}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                    <span>
                      Page {page} of {totalPages} · {total} records
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPage((p) => p - 1)}
                        disabled={page === 1}
                        className="px-3 py-1.5 border rounded-md disabled:opacity-40 hover:bg-gray-50 transition"
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 border rounded-md disabled:opacity-40 hover:bg-gray-50 transition"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────
export default function CouponList() {
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

  const { data, isLoading, isFetching } = useQuery(
    ['admin-coupons', page, search, status, type, sortBy, sortOrder],
    () => api.getCouponCodesByAdmin(page, search, status, type, sortBy, sortOrder),
    { keepPreviousData: true }
  );

  const { mutate: deleteMut } = useMutation(api.deleteCouponCodeByAdmin, {
    onSuccess: () => {
      Swal.fire({ title: 'Coupon deleted!', icon: 'success', timer: 1200, showConfirmButton: false });
      qc.invalidateQueries('admin-coupons');
    },
    onError: (err) => Swal.fire('Error', err.response?.data?.message || 'Failed', 'error')
  });

  const handleDelete = async (c) => {
    const r = await Swal.fire({
      title: `Delete "${c.code}"?`,
      text: 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete'
    });
    if (r.isConfirmed) deleteMut(c._id);
  };

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
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[13px] font-bold tracking-widest text-slate-900">
            {c.code}
          </span>
          {c.isAffiliate && (
            <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--brand-strong)' }}>
              affiliate
            </span>
          )}
        </>
      )
    },
    { key: 'name', label: 'Name', sortable: true, render: (c) => <span className="text-slate-700">{c.name}</span> },
    {
      key: 'discount',
      label: 'Discount',
      sortable: true,
      render: (c) => (
        <>
          <span className="font-semibold text-slate-800">
            {c.type === 'percent' ? `${c.discount}%` : `${BDT}${c.discount}`}
          </span>
          <span className="ml-1 text-xs capitalize text-slate-400">({c.type})</span>
        </>
      )
    },
    { key: 'applyTo', label: 'Applies To', render: (c) => <ApplyBadge applyTo={c.applyTo} /> },
    {
      key: 'minPurchase',
      label: 'Min Purchase',
      sortable: true,
      align: 'right',
      render: (c) => <span className="text-slate-600">{c.minPurchase > 0 ? `${BDT}${c.minPurchase}` : '—'}</span>
    },
    {
      key: 'uses',
      label: 'Uses',
      align: 'right',
      render: (c) => (
        <button
          onClick={() => setStatsFor(c)}
          className="inline-flex items-center gap-1 text-[13px] font-semibold transition hover:underline"
          style={{ color: 'var(--brand-strong)' }}
          title="View usage statistics"
        >
          {c.usedBy?.length || 0}
          {c.maxUses > 0 && <span className="font-normal text-slate-400"> / {c.maxUses}</span>}
          <MdBarChart size={14} className="opacity-60" />
        </button>
      )
    },
    {
      key: 'expire',
      label: 'Expires',
      sortable: true,
      render: (c) => <span className="text-slate-600">{fmtDate(c.expire)}</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (c) => <StatusBadge status={c.status} />
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setStatsFor(c)}
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Usage statistics"
          >
            <MdBarChart size={17} />
          </button>
          <Link
            href={`/coupon-codes/${c._id}`}
            className="rounded-md p-2 transition hover:bg-slate-100"
            style={{ color: 'var(--brand-strong)' }}
            title="Edit"
          >
            <MdEdit size={17} />
          </Link>
          {c.isAffiliate ? (
            <span
              className="cursor-not-allowed p-2 text-slate-300"
              title="Affiliate coupons are managed from the Affiliates section in the Admin (HRM) panel"
            >
              <MdDelete size={17} />
            </span>
          ) : (
            <button
              onClick={() => handleDelete(c)}
              className="rounded-md p-2 text-red-400 transition hover:bg-red-50"
              title="Delete"
            >
              <MdDelete size={17} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {statsFor && <UsageDrawer coupon={statsFor} onClose={() => setStatsFor(null)} />}

      <PageHeader title="Coupon Codes" subtitle={`${total} coupon${total !== 1 ? 's' : ''} total`}>
        <Link href="/coupon-codes/add" className="btn-brand">
          <MdAdd size={18} /> Add Coupon
        </Link>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search by code or name…"
        onReset={() => {
          setSearch('');
          setStatus('');
          setType('');
          setSortBy('');
          setPage(1);
        }}
      >
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[130px]"
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
        >
          {TYPE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        columns={columns}
        data={coupons}
        sort={sort}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No coupons found" icon={MdInbox} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="coupons" />}
      />
    </div>
  );
}
