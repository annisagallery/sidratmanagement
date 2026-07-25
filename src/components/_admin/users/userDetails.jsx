'use client';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Link from 'next/link';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import {
  MdArrowBack,
  MdPerson,
  MdShoppingCart,
  MdWallet,
  MdDiscount,
  MdCheckCircle,
  MdCancel,
  MdPending,
  MdLocalShipping,
  MdAttachMoney,
  MdClose,
  MdLocationOn,
  MdStar,
  MdHome,
  MdWork,
  MdStarBorder
} from 'react-icons/md';
import { FiPackage } from 'react-icons/fi';
import { fDate, fDateTime } from 'src/utils/formatTime';
import { addressDistrict, addressUpazila } from 'src/utils/bangladeshAddress';

const BDT = '৳';

function fmtDate(d) {
  if (!d) return '—';
  return fDate(d);
}
function fmtDateTime(d) {
  if (!d) return '—';
  return fDateTime(d);
}

function Avatar({ name, size = 'lg' }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-9 h-9 text-sm';
  return (
    <div
      className={`${sz} rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0`}
    >
      {name?.slice(0, 2)?.toUpperCase() || '?'}
    </div>
  );
}

function Pill({ label, cls }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${cls}`}>{label}</span>
  );
}

const ORDER_STATUS = {
  pending: { cls: 'bg-amber-50 text-amber-700', icon: MdPending },
  confirmed: { cls: 'bg-blue-50 text-blue-700', icon: MdCheckCircle },
  processing: { cls: 'bg-purple-50 text-purple-700', icon: FiPackage },
  shipped: { cls: 'bg-cyan-50 text-cyan-700', icon: MdLocalShipping },
  delivered: { cls: 'bg-green-50 text-green-700', icon: MdCheckCircle },
  cancelled: { cls: 'bg-red-50 text-red-500', icon: MdCancel },
  returned: { cls: 'bg-orange-50 text-orange-600', icon: MdArrowBack }
};

const CASH_TYPE = {
  earned: { label: 'Earned', cls: 'bg-green-100 text-green-700', sign: '+' },
  spent: { label: 'Spent', cls: 'bg-red-100 text-red-500', sign: '-' },
  expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-500', sign: '-' },
  manual_credit: { label: 'Manual Credit', cls: 'bg-blue-100 text-blue-700', sign: '+' },
  manual_debit: { label: 'Manual Debit', cls: 'bg-orange-100 text-orange-700', sign: '-' }
};

function Skeleton({ rows = 5 }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 bg-gray-100 rounded-md animate-pulse w-24" />
          <div className="flex-1">
            <div className="h-4 bg-gray-100 rounded-md animate-pulse w-1/3" />
          </div>
          <div className="h-4 bg-gray-100 rounded-md animate-pulse w-16" />
          <div className="h-5 bg-gray-100 rounded-md animate-pulse w-20" />
          <div className="h-4 bg-gray-100 rounded-md animate-pulse w-20" />
        </div>
      ))}
    </div>
  );
}

function Pager({ page, totalPages, total, label, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 text-xs text-gray-500">
      <span>
        Page {page} of {totalPages} · {total} {label}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPage((p) => p - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 border rounded-md disabled:opacity-40 hover:bg-white transition"
        >
          ← Prev
        </button>
        <button
          onClick={() => onPage((p) => p + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 border rounded-md disabled:opacity-40 hover:bg-white transition"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Tab: Orders ───────────────────────────────────────────────────────────────
function OrdersTab({ userPhone }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(['u-orders', userPhone, page], () => api.getUserOrdersByAdmin(userPhone, page), {
    keepPreviousData: true
  });
  const orders = data?.data || [];
  const total = data?.total || 0;
  const pages = data?.count || 1;

  return (
    <div className="bg-white border rounded-md overflow-hidden">
      {isLoading ? (
        <Skeleton />
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MdShoppingCart size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No orders yet</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <GlobalTable className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Order No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Coupon
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => {
                  const st = ORDER_STATUS[o.status] || { cls: 'bg-gray-50 text-gray-600', icon: MdPending };
                  const Icon = st.icon;
                  return (
                    <tr key={o._id} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${o.orderNo}`}
                          className="font-mono text-sm font-bold text-blue-600 hover:underline"
                        >
                          #{o.orderNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-semibold capitalize ${st.cls}`}
                        >
                          <Icon size={12} />
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 capitalize">{o.paymentMethod}</span>
                        <span
                          className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-md ${o.paymentStatus === 'paid' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {o.couponCode ? (
                          <span className="font-mono text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md">
                            {o.couponCode}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-800">
                          {BDT}
                          {o.total?.toLocaleString()}
                        </span>
                        {(o.discount > 0 || o.cashDiscount > 0) && (
                          <p className="text-xs text-green-600 mt-0.5">
                            -{BDT}
                            {((o.discount || 0) + (o.cashDiscount || 0)).toLocaleString()} off
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{fmtDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </GlobalTable>
          </div>
          <Pager page={page} totalPages={pages} total={total} label="orders" onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ── Tab: Cash Transactions ────────────────────────────────────────────────────
function CashTab({ userPhone }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(['u-cash', userPhone, page], () => api.getUserCashByAdmin(userPhone, page), {
    keepPreviousData: true
  });
  const txns = data?.data || [];
  const total = data?.total || 0;
  const pages = data?.count || 1;

  return (
    <div className="bg-white border rounded-md overflow-hidden">
      {isLoading ? (
        <Skeleton />
      ) : txns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MdWallet size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No cash transactions</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <GlobalTable className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Order
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Balance After
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {txns.map((t) => {
                  const ct = CASH_TYPE[t.type] || { label: t.type, cls: 'bg-gray-100 text-gray-600', sign: '' };
                  const isPositive = ct.sign === '+';
                  return (
                    <tr key={t._id} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${ct.cls}`}>{ct.label}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm text-gray-700 truncate">{t.description || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {t.order?.orderNo ? (
                          <Link
                            href={`/orders/${t.order.orderNo}`}
                            className="font-mono text-xs text-blue-600 hover:underline"
                          >
                            #{t.order.orderNo}
                          </Link>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${isPositive ? 'text-green-700' : 'text-red-500'}`}>
                          {ct.sign}
                          {BDT}
                          {t.amount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-700">
                          {BDT}
                          {t.balanceAfter?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{fmtDate(t.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </GlobalTable>
          </div>
          <Pager page={page} totalPages={pages} total={total} label="transactions" onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ── Tab: Coupons Used ─────────────────────────────────────────────────────────
function CouponsTab({ userPhone }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(
    ['u-coupons', userPhone, page],
    () => api.getUserCouponUsagesByAdmin(userPhone, page),
    { keepPreviousData: true }
  );
  const usages = data?.data || [];
  const total = data?.total || 0;
  const pages = data?.count || 1;

  return (
    <div className="bg-white border rounded-md overflow-hidden">
      {isLoading ? (
        <Skeleton />
      ) : usages.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MdDiscount size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No coupons used</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <GlobalTable className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Coupon
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Order
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Order Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Applies To
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {usages.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                        {u.couponCode}
                      </span>
                      {u.coupon?.isAffiliate && (
                        <span className="ml-1.5 text-xs text-blue-600 font-medium">affiliate</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.order?.orderNo ? (
                        <Link
                          href={`/orders/${u.order.orderNo}`}
                          className="font-mono text-sm text-blue-600 hover:underline"
                        >
                          #{u.order.orderNo}
                        </Link>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {BDT}
                      {u.orderTotal?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">
                      -{BDT}
                      {u.discountAmount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-semibold capitalize ${u.applyTo === 'shipping' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}
                      >
                        {u.applyTo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </GlobalTable>
          </div>
          <Pager page={page} totalPages={pages} total={total} label="usages" onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ── Tab: Addresses ────────────────────────────────────────────────────────────
function AddressesTab({ userPhone }) {
  const { data, isLoading } = useQuery(['u-addresses', userPhone], () => api.getUserAddressesByAdmin(userPhone));
  const addresses = data?.data || [];

  const labelIcon = (label = '') => {
    const l = label.toLowerCase();
    if (l === 'work' || l === 'office') return MdWork;
    return MdHome;
  };

  return (
    <div className="bg-white border rounded-md overflow-hidden">
      {isLoading ? (
        <div className="space-y-0 divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 px-5 py-4">
              <div className="w-8 h-8 rounded-md bg-gray-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-100 rounded-md animate-pulse w-40" />
                <div className="h-3 bg-gray-100 rounded-md animate-pulse w-56" />
                <div className="h-3 bg-gray-100 rounded-md animate-pulse w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MdLocationOn size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No saved addresses</p>
        </div>
      ) : (
        <div className="divide-y">
          {addresses.map((addr) => {
            const Icon = labelIcon(addr.label);
            return (
              <div key={addr._id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50 transition">
                <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-800 capitalize">{addr.label || 'Home'}</p>
                    {addr.isDefault && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 font-semibold">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{addr.address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[addressUpazila(addr), addressDistrict(addr)].filter(Boolean).join(', ')}
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">{fmtDate(addr.createdAt)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Reviews ──────────────────────────────────────────────────────────────
function StarRating({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) =>
        i < rating ? (
          <MdStar key={i} size={14} className="text-amber-400" />
        ) : (
          <MdStarBorder key={i} size={14} className="text-gray-300" />
        )
      )}
    </span>
  );
}

function ReviewsTab({ userPhone }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(
    ['u-reviews', userPhone, page],
    () => api.getUserReviewsByAdmin(userPhone, page),
    { keepPreviousData: true }
  );
  const reviews = data?.data || [];
  const total = data?.total || 0;
  const pages = data?.count || 1;

  return (
    <div className="bg-white border rounded-md overflow-hidden">
      {isLoading ? (
        <Skeleton rows={4} />
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MdStar size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No reviews yet</p>
        </div>
      ) : (
        <>
          <div className="divide-y">
            {reviews.map((r) => (
              <div key={r._id} className="px-5 py-4 hover:bg-gray-50/50 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StarRating rating={r.rating} />
                      <span className="text-xs text-gray-500 font-medium">{r.rating}/5</span>
                      {r.isPurchased && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 font-semibold">
                          Verified
                        </span>
                      )}
                    </div>
                    {r.product && (
                      <Link
                        href={`/products/${r.product.slug}`}
                        className="text-xs text-blue-600 hover:underline font-medium mb-1 block truncate"
                      >
                        {r.product.name}
                      </Link>
                    )}
                    <p className="text-sm text-gray-700 mt-1">{r.review}</p>
                    {r.designation && r.designation !== 'Customer' && (
                      <p className="text-xs text-gray-400 mt-0.5 italic">{r.designation}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{fmtDate(r.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          <Pager page={page} totalPages={pages} total={total} label="reviews" onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ── Give Cashback Modal ───────────────────────────────────────────────────────
function CashModal({ user, onClose, onDone }) {
  const [form, setForm] = useState({ type: 'manual_credit', amount: '', message: '' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const isCredit = form.type === 'manual_credit';

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      Swal.fire('Validation', 'Enter a valid amount.', 'warning');
      return;
    }
    if (!form.message.trim()) {
      Swal.fire('Validation', 'Enter a message for this adjustment.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await api.adminAdjustCash({
        userId: user._id,
        amount: Number(form.amount),
        type: form.type,
        message: form.message.trim()
      });
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Cashback ${isCredit ? 'credited' : 'debited'}!`,
        showConfirmButton: false,
        timer: 2000
      });
      onDone();
      onClose();
    } catch (err) {
      Swal.fire('Error', err?.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-md shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-800">Adjust Cashback</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {user.name} · Balance: ৳{(user.cash || 0).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition"
          >
            <MdClose size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Operation</label>
            <div className="flex gap-2">
              {[
                { value: 'manual_credit', label: '+ Credit' },
                { value: 'manual_debit', label: '- Debit' }
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: o.value }))}
                  className={`flex-1 py-2 rounded-md border text-sm font-semibold transition ${
                    form.type === o.value
                      ? o.value === 'manual_credit'
                        ? 'bg-green-50 border-green-400 text-green-700'
                        : 'bg-red-50 border-red-400 text-red-600'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (৳)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.amount}
              onChange={set('amount')}
              placeholder="e.g. 50"
              className="w-full border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message</label>
            <input
              value={form.message}
              onChange={set('message')}
              placeholder="Explain this adjustment"
              required
              className="w-full border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition ${isCredit ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {saving ? 'Saving…' : isCredit ? 'Credit ৳' : 'Debit ৳'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const TABS = [
  { key: 'orders', label: 'Orders', icon: MdShoppingCart },
  { key: 'cash', label: 'Cash', icon: MdWallet },
  { key: 'coupons', label: 'Coupons Used', icon: MdDiscount },
  { key: 'addresses', label: 'Addresses', icon: MdLocationOn },
  { key: 'reviews', label: 'Reviews', icon: MdStar }
];

export default function UserDetails({ userPhone }) {
  const [tab, setTab] = useState('orders');
  const [showCash, setShowCash] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(['user-activity', userPhone], () => api.getUserActivityByAdmin(userPhone), {
    enabled: !!userPhone
  });

  const { user, stats } = data?.data || {};
  const onRefresh = () => qc.invalidateQueries(['user-activity', userPhone]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 bg-gray-100 rounded-md animate-pulse w-48" />
        <div className="bg-white border rounded-md p-6 flex gap-5">
          <div className="w-16 h-16 rounded-md bg-gray-100 animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-gray-100 rounded-md animate-pulse w-40" />
            <div className="h-4 bg-gray-100 rounded-md animate-pulse w-56" />
            <div className="h-4 bg-gray-100 rounded-md animate-pulse w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-gray-400">
        <MdPerson size={48} className="mx-auto mb-3 opacity-20" />
        <p>User not found</p>
        <Link href="/users" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          ← Back to users
        </Link>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Orders',
      value: stats?.totalOrders || 0,
      sub: `${stats?.delivered || 0} delivered`,
      cls: 'text-blue-600',
      bg: 'bg-blue-50',
      Icon: MdShoppingCart
    },
    {
      label: 'Total Spent',
      value: `${BDT}${(stats?.totalSpent || 0).toLocaleString()}`,
      sub: `${stats?.cancelled || 0} cancelled`,
      cls: 'text-purple-600',
      bg: 'bg-purple-50',
      Icon: MdAttachMoney
    },
    {
      label: 'Cash Balance',
      value: `${BDT}${(stats?.cashBalance || 0).toLocaleString()}`,
      sub: `${BDT}${(stats?.cashEarned || 0).toLocaleString()} earned total`,
      cls: 'text-green-600',
      bg: 'bg-green-50',
      Icon: MdWallet
    },
    {
      label: 'Coupons Used',
      value: stats?.couponUses || 0,
      sub: 'total redemptions',
      cls: 'text-amber-600',
      bg: 'bg-amber-50',
      Icon: MdDiscount
    }
  ];

  return (
    <div className="space-y-5">
      {/* Modals */}
      {showCash && <CashModal user={user} onClose={() => setShowCash(false)} onDone={onRefresh} />}

      {/* Back */}
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
      >
        <MdArrowBack size={16} /> Back to Users
      </Link>

      {/* Profile card */}
      <div className="bg-white border rounded-md p-6">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={user.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <Pill
                label={user.role}
                cls={
                  user.role === 'admin' || user.role === 'super admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }
              />
              <Pill
                label={user.status}
                cls={user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}
              />
              {user.isVerified && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                  <MdCheckCircle size={13} /> Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
            <p className="text-sm text-gray-500">{user.phone}</p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right text-xs text-gray-400 space-y-1">
              <p>
                Joined: <span className="text-gray-600">{fmtDate(user.createdAt)}</span>
              </p>
              <p>
                Last login: <span className="text-gray-600">{fmtDateTime(user.lastLogin)}</span>
              </p>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowCash(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-300 text-green-700 rounded-md text-xs font-semibold hover:bg-green-100 transition"
              >
                <MdWallet size={14} /> Give Cashback
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.Icon;
          return (
            <div key={s.label} className={`${s.bg} rounded-md p-4`}>
              <Icon size={18} className={`${s.cls} mb-1.5`} />
              <p className={`text-lg font-bold leading-tight capitalize ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs nav */}
      <div className="flex border-b">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
                active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'orders' && <OrdersTab userPhone={userPhone} />}
      {tab === 'cash' && <CashTab userPhone={userPhone} />}
      {tab === 'coupons' && <CouponsTab userPhone={userPhone} />}
      {tab === 'addresses' && <AddressesTab userPhone={userPhone} />}
      {tab === 'reviews' && <ReviewsTab userPhone={userPhone} />}
    </div>
  );
}
