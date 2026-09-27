'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Link from 'next/link';
import {
  MdArrowBack,
  MdPerson,
  MdShoppingCart,
  MdWallet,
  MdDiscount,
  MdCheckCircle,
  MdLocationOn,
  MdStar,
  MdHome,
  MdWork,
  MdStarBorder
} from 'react-icons/md';
import * as api from 'src/services';
import CashModal from 'src/components/_admin/cashSettings/_CashModal';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import Tabs from 'src/components/_admin/ui/Tabs';
import Badge, { RecordStatus } from 'src/components/_admin/ui/Badge';
import { KpiGrid, StatTile } from 'src/components/_admin/ui/kpi';
import { EmptyState, ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';
import { fDate, fDateTime } from 'src/utils/formatTime';
import { addressDistrict, addressUpazila } from 'src/utils/bangladeshAddress';
import { isAdminAccount } from 'src/utils/adminRole';

const BDT = '৳';
const money = (value) => `${BDT}${Number(value || 0).toLocaleString()}`;

function fmtDate(d) {
  return d ? fDate(d) : '—';
}
function fmtDateTime(d) {
  return d ? fDateTime(d) : '—';
}

const ORDER_TONE = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'violet',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'warning'
};

const CASH_TYPE = {
  earned: { label: 'Earned', tone: 'success', sign: '+' },
  spent: { label: 'Spent', tone: 'neutral', sign: '−' },
  expired: { label: 'Expired', tone: 'neutral', sign: '−' },
  manual_credit: { label: 'Manual credit', tone: 'info', sign: '+' },
  manual_debit: { label: 'Manual debit', tone: 'warning', sign: '−' }
};

const label = (value) => (value ? String(value).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—');

/** One tab's table surface: loading, failure, empty or the rows, plus paging. */
function TabSurface({ query, empty, emptyIcon, children, pagination }) {
  if (query.isLoading) return <LoadingBlock rows={5} />;
  if (query.isError) return <ErrorState error={query.error} title="This could not be loaded" onRetry={query.refetch} />;
  if (!children) {
    return (
      <div className="card-ui">
        <EmptyState compact icon={emptyIcon} title={empty} />
      </div>
    );
  }
  return (
    <div className="card-ui overflow-hidden">
      {children}
      {pagination}
    </div>
  );
}

// ── Tab: Orders ───────────────────────────────────────────────────────────────
function OrdersTab({ userPhone }) {
  const [page, setPage] = useState(1);
  const query = useQuery(['u-orders', userPhone, page], () => api.getUserOrdersByAdmin(userPhone, page), {
    keepPreviousData: true
  });
  const orders = query.data?.data || [];

  return (
    <TabSurface
      query={query}
      empty="No orders yet"
      emptyIcon={MdShoppingCart}
      pagination={<Pagination page={page} totalPages={query.data?.count || 1} total={query.data?.total} unit="orders" onPage={setPage} />}
    >
      {orders.length ? (
        <GlobalTable>
          <caption className="sr-only">Orders</caption>
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Status</th>
              <th scope="col" className="hidden md:table-cell">Payment</th>
              <th scope="col" className="hidden lg:table-cell">Coupon</th>
              <th scope="col" className="text-right">Total</th>
              <th scope="col" className="hidden sm:table-cell text-right">Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/orders/${o.orderNo}`} className="ops-code font-semibold text-slate-900 hover:underline">
                    #{o.orderNo}
                  </Link>
                </td>
                <td>
                  <Badge tone={ORDER_TONE[o.status] || 'neutral'} dot>
                    {label(o.status)}
                  </Badge>
                </td>
                <td className="hidden md:table-cell">
                  <span className="text-[13px] uppercase text-slate-600">{o.paymentMethod}</span>{' '}
                  <Badge tone={o.paymentStatus === 'paid' ? 'success' : 'neutral'}>{label(o.paymentStatus)}</Badge>
                </td>
                <td className="hidden lg:table-cell">
                  {o.couponCode ? <span className="code-chip">{o.couponCode}</span> : <span className="text-slate-400">—</span>}
                </td>
                <td className="text-right">
                  <span className="font-semibold tabular-nums text-slate-900">{money(o.total)}</span>
                  {(o.discount > 0 || o.cashDiscount > 0) && (
                    <p className="mt-0.5 text-xs text-emerald-700">
                      {money((o.discount || 0) + (o.cashDiscount || 0))} off
                    </p>
                  )}
                </td>
                <td className="hidden text-right text-slate-600 sm:table-cell">{fmtDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </GlobalTable>
      ) : null}
    </TabSurface>
  );
}

// ── Tab: Cash transactions ────────────────────────────────────────────────────
function CashTab({ userPhone }) {
  const [page, setPage] = useState(1);
  const query = useQuery(['u-cash', userPhone, page], () => api.getUserCashByAdmin(userPhone, page), {
    keepPreviousData: true
  });
  const txns = query.data?.data || [];

  return (
    <TabSurface
      query={query}
      empty="No cashback activity"
      emptyIcon={MdWallet}
      pagination={<Pagination page={page} totalPages={query.data?.count || 1} total={query.data?.total} unit="transactions" onPage={setPage} />}
    >
      {txns.length ? (
        <GlobalTable>
          <caption className="sr-only">Cashback transactions</caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col" className="hidden md:table-cell">Reason</th>
              <th scope="col" className="hidden sm:table-cell">Order</th>
              <th scope="col" className="text-right">Amount</th>
              <th scope="col" className="text-right">Balance after</th>
              <th scope="col" className="hidden lg:table-cell text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => {
              const ct = CASH_TYPE[t.type] || { label: label(t.type), tone: 'neutral', sign: '' };
              const positive = ct.sign === '+';
              return (
                <tr key={t.id}>
                  <td>
                    <Badge tone={ct.tone}>{ct.label}</Badge>
                  </td>
                  <td className="hidden max-w-[240px] md:table-cell">
                    <p className="truncate text-slate-700">{t.description || '—'}</p>
                  </td>
                  <td className="hidden sm:table-cell">
                    {t.order?.orderNo ? (
                      <Link href={`/orders/${t.order.orderNo}`} className="ops-code text-slate-900 hover:underline">
                        #{t.order.orderNo}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    <span className={`font-semibold tabular-nums ${positive ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {ct.sign}
                      {money(t.amount)}
                    </span>
                  </td>
                  <td className="text-right tabular-nums text-slate-700">{money(t.balanceAfter)}</td>
                  <td className="hidden text-right text-slate-600 lg:table-cell">{fmtDate(t.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </GlobalTable>
      ) : null}
    </TabSurface>
  );
}

// ── Tab: Coupons used ─────────────────────────────────────────────────────────
function CouponsTab({ userPhone }) {
  const [page, setPage] = useState(1);
  const query = useQuery(['u-coupons', userPhone, page], () => api.getUserCouponUsagesByAdmin(userPhone, page), {
    keepPreviousData: true
  });
  const usages = query.data?.data || [];

  return (
    <TabSurface
      query={query}
      empty="No coupons used"
      emptyIcon={MdDiscount}
      pagination={<Pagination page={page} totalPages={query.data?.count || 1} total={query.data?.total} unit="uses" onPage={setPage} />}
    >
      {usages.length ? (
        <GlobalTable>
          <caption className="sr-only">Coupons used</caption>
          <thead>
            <tr>
              <th scope="col">Coupon</th>
              <th scope="col">Order</th>
              <th scope="col" className="hidden md:table-cell text-right">Order total</th>
              <th scope="col" className="text-right">Discount</th>
              <th scope="col" className="hidden sm:table-cell">Applies to</th>
              <th scope="col" className="hidden lg:table-cell text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {usages.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="code-chip">{u.couponCode}</span>
                  {u.coupon?.isAffiliate && <Badge className="ml-2">Affiliate</Badge>}
                </td>
                <td>
                  {u.order?.orderNo ? (
                    <Link href={`/orders/${u.order.orderNo}`} className="ops-code text-slate-900 hover:underline">
                      #{u.order.orderNo}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="hidden text-right tabular-nums md:table-cell">{money(u.orderTotal)}</td>
                <td className="text-right font-semibold tabular-nums text-emerald-700">−{money(u.discountAmount)}</td>
                <td className="hidden sm:table-cell">
                  <Badge tone={u.applyTo === 'shipping' ? 'info' : 'violet'}>{label(u.applyTo)}</Badge>
                </td>
                <td className="hidden text-right text-slate-600 lg:table-cell">{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </GlobalTable>
      ) : null}
    </TabSurface>
  );
}

// ── Tab: Addresses ────────────────────────────────────────────────────────────
function AddressesTab({ userPhone }) {
  const query = useQuery(['u-addresses', userPhone], () => api.getUserAddressesByAdmin(userPhone));
  const addresses = query.data?.data || [];

  const labelIcon = (value = '') => (['work', 'office'].includes(value.toLowerCase()) ? MdWork : MdHome);

  return (
    <TabSurface query={query} empty="No saved addresses" emptyIcon={MdLocationOn}>
      {addresses.length ? (
        <ul className="divide-y divide-slate-100">
          {addresses.map((addr) => {
            const Icon = labelIcon(addr.label);
            return (
              <li key={addr.id} className="flex items-start gap-4 px-5 py-4">
                <Icon size={20} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold capitalize text-slate-900">{addr.label || 'Home'}</p>
                    {addr.isDefault && <Badge tone="success">Default</Badge>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-slate-700">{addr.address}</p>
                  <p className="text-xs text-slate-500">{[addressUpazila(addr), addressDistrict(addr)].filter(Boolean).join(', ')}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-500">Added {fmtDate(addr.createdAt)}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </TabSurface>
  );
}

// ── Tab: Reviews ──────────────────────────────────────────────────────────────
function StarRating({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) =>
        i < rating ? (
          <MdStar key={i} size={15} className="text-amber-500" aria-hidden />
        ) : (
          <MdStarBorder key={i} size={15} className="text-slate-300" aria-hidden />
        )
      )}
    </span>
  );
}

function ReviewsTab({ userPhone }) {
  const [page, setPage] = useState(1);
  const query = useQuery(['u-reviews', userPhone, page], () => api.getUserReviewsByAdmin(userPhone, page), {
    keepPreviousData: true
  });
  const reviews = query.data?.data || [];

  return (
    <TabSurface
      query={query}
      empty="No reviews yet"
      emptyIcon={MdStar}
      pagination={<Pagination page={page} totalPages={query.data?.count || 1} total={query.data?.total} unit="reviews" onPage={setPage} />}
    >
      {reviews.length ? (
        <ul className="divide-y divide-slate-100">
          {reviews.map((r) => (
            <li key={r.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating rating={r.rating} />
                    <span className="text-xs font-medium tabular-nums text-slate-600" aria-hidden>
                      {r.rating}/5
                    </span>
                    {r.isPurchased && <Badge tone="success">Verified purchase</Badge>}
                  </div>
                  {r.product && (
                    <Link href={`/products/${r.product.slug}`} className="mt-1 block truncate text-[13px] font-medium text-slate-900 hover:underline">
                      {r.product.name}
                    </Link>
                  )}
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{r.review}</p>
                  {r.designation && r.designation !== 'Customer' && <p className="mt-0.5 text-xs text-slate-500">{r.designation}</p>}
                </div>
                <p className="shrink-0 whitespace-nowrap text-xs text-slate-500">{fmtDate(r.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </TabSurface>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'orders', label: 'Orders', icon: MdShoppingCart },
  { id: 'cash', label: 'Cashback', icon: MdWallet },
  { id: 'coupons', label: 'Coupons used', icon: MdDiscount },
  { id: 'addresses', label: 'Addresses', icon: MdLocationOn },
  { id: 'reviews', label: 'Reviews', icon: MdStar }
];

export default function UserDetails({ userPhone }) {
  const [tab, setTab] = useState('orders');
  const [showCash, setShowCash] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery(
    ['user-activity', userPhone],
    () => api.getUserActivityByAdmin(userPhone),
    { enabled: !!userPhone }
  );

  const { user, stats } = data?.data || {};
  const onRefresh = () => qc.invalidateQueries(['user-activity', userPhone]);

  const back = (
    <Link href="/users" className="btn-ghost btn-sm">
      <MdArrowBack size={16} aria-hidden /> Back to customers
    </Link>
  );

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="card-ui space-y-3 p-5">
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="card-ui h-24 animate-pulse" />
        <LoadingBlock rows={5} />
      </div>
    );
  }

  if (isError && !user) {
    return (
      <div className="space-y-6">
        {back}
        <ErrorState error={error} title="This customer could not be loaded" onRetry={refetch} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        {back}
        <div className="card-ui">
          <EmptyState icon={MdPerson} title="Customer not found" hint="The phone number may be wrong, or the account was removed." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showCash && <CashModal user={user} onClose={() => setShowCash(false)} onDone={onRefresh} />}

      {back}

      {/* Profile */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-700 ring-1 ring-slate-200"
            aria-hidden
          >
            {user.name?.slice(0, 2)?.toUpperCase() || '?'}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{user.name}</h1>
              <Badge tone={isAdminAccount(user) ? 'violet' : 'neutral'}>{label(user.role)}</Badge>
              <RecordStatus status={user.status} />
              {user.isVerified && (
                <Badge tone="success">
                  <MdCheckCircle size={13} aria-hidden /> Verified
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[13px] text-slate-600">
              {[user.phone, user.email].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Joined {fmtDate(user.createdAt)} · Last signed in {fmtDateTime(user.lastLogin)}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setShowCash(true)} className="btn-brand">
          <MdWallet size={17} aria-hidden /> Adjust cashback
        </button>
      </div>

      <KpiGrid>
        <StatTile label="Orders" value={(stats?.totalOrders || 0).toLocaleString()} hint={`${stats?.delivered || 0} delivered`} />
        <StatTile label="Total spent" value={money(stats?.totalSpent)} hint={`${stats?.cancelled || 0} cancelled`} />
        <StatTile label="Cashback balance" value={money(stats?.cashBalance)} hint={`${money(stats?.cashEarned)} earned in total`} />
        <StatTile label="Coupons used" value={(stats?.couponUses || 0).toLocaleString()} hint="Redemptions" />
      </KpiGrid>

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Customer activity" />

      {tab === 'orders' && <OrdersTab userPhone={userPhone} />}
      {tab === 'cash' && <CashTab userPhone={userPhone} />}
      {tab === 'coupons' && <CouponsTab userPhone={userPhone} />}
      {tab === 'addresses' && <AddressesTab userPhone={userPhone} />}
      {tab === 'reviews' && <ReviewsTab userPhone={userPhone} />}
    </div>
  );
}
