'use client';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { toast } from 'react-toastify';
import Link from 'next/link';
import * as api from 'src/services';
import { useSiteSettings } from 'src/context/SiteSettingsContext';

import {
  MdAttachMoney,
  MdShoppingBag,
  MdPeople,
  MdInventory2,
  MdPendingActions,
  MdUndo,
  MdOpenInNew,
  MdTrendingUp,
  MdEmail,
  MdPhone
} from 'react-icons/md';
import { HiChevronRight } from 'react-icons/hi';
import { fDate } from 'src/utils/formatTime';

const BDT = '৳';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (n) => (n ?? 0).toLocaleString('en-US');
const fmtBdt = (n) => BDT + fmt(n);
const fmtToday = () => fDate(new Date());

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, bg, color, href, isLoading }) {
  const inner = (
    <div
      className={`bg-white rounded-md border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-4 transition-all ${href ? 'hover:shadow-md hover:border-gray-200' : ''}`}
    >
      <div className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${bg}`}>
        <Icon size={20} className={color} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
        {isLoading ? (
          <div className="h-6 w-20 bg-gray-100 rounded-md animate-pulse mt-1" />
        ) : (
          <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        )}
      </div>
      {href && <HiChevronRight className="text-gray-300 shrink-0" />}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Pure-CSS bar chart (no third-party deps) ─────────────────────────────────
function BarChart({ data, categories, color }) {
  const max = Math.max(...data, 1);
  // show every nth label to avoid crowding
  const step = data.length <= 12 ? 1 : Math.ceil(data.length / 10);

  return (
    <div className="flex items-end gap-px h-52">
      {data.map((v, i) => (
        <div
          key={i}
          title={`${categories[i]}: ${BDT}${v.toLocaleString('en-US')}`}
          className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end min-w-0"
        >
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: `${(v / max) * 100}%`,
              minHeight: v > 0 ? '3px' : '0',
              backgroundColor: color
            }}
          />
          <p className="text-[8px] text-gray-400 leading-none truncate w-full text-center select-none">
            {i % step === 0 ? categories[i] : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── SVG donut chart (no third-party deps) ────────────────────────────────────
function SvgDonut({ series, colors, labels }) {
  const total = series.reduce((a, b) => a + b, 0);
  const r = 52,
    cx = 68,
    cy = 68,
    sw = 22;
  const circumference = 2 * Math.PI * r;

  let cum = 0;
  const segments = series.map((v, i) => {
    const dash = total > 0 ? (v / total) * circumference : 0;
    const offset = circumference - cum;
    cum += dash;
    return { dash, offset, color: colors[i], label: labels[i], v };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 136 136" width={136} height={136}>
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={sw} />
        ) : (
          segments.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={sw}
              strokeDasharray={`${s.dash} ${circumference}`}
              strokeDashoffset={s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))
        )}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="21" fontWeight="700" fill="#111827">
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="10" fill="#9CA3AF">
          Total
        </text>
      </svg>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs w-full px-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 min-w-0">
            <div className="w-2 h-2 rounded-md shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-gray-500 truncate">{s.label}</span>
            <span className="ml-auto font-semibold text-gray-800 shrink-0">{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Income chart panel ────────────────────────────────────────────────────────
function IncomeChart({ income, primaryColor, isLoading }) {
  const [period, setPeriod] = useState('week');
  const color = primaryColor || '#c8a96e';

  const pastWeekDays = [...Array(7).keys()].map((d) =>
    new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(Date.now() - 86400000 * (6 - d)))
  );

  const categories =
    period === 'year'
      ? MONTHS
      : period === 'month'
        ? Array.from({ length: 31 }, (_, i) => String(i + 1))
        : pastWeekDays;

  const rawData = Array.isArray(income?.[period]) ? income[period] : [];
  const data = categories.map((_, i) => {
    const v = rawData[i];
    return v == null || isNaN(v) ? 0 : Number(v);
  });
  const hasData = data.some((v) => v > 0);

  const tabs = [
    { key: 'week', label: '7D' },
    { key: 'month', label: '30D' },
    { key: 'year', label: '12M' }
  ];

  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-bold text-gray-900">Revenue</p>
          <p className="text-xs text-gray-400 mt-0.5">Income over time</p>
        </div>
        <div className="flex bg-gray-100 rounded-md p-0.5 gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                period === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="h-52 bg-gray-50 rounded-md animate-pulse" />
        ) : !hasData ? (
          <div className="h-52 flex items-center justify-center flex-col gap-2 text-gray-300">
            <MdTrendingUp size={36} />
            <p className="text-sm">No revenue data for this period</p>
          </div>
        ) : (
          <BarChart data={data} categories={categories} color={color} />
        )}
      </div>
    </div>
  );
}

// ── Order donut panel ─────────────────────────────────────────────────────────
function OrderDonut({ data, isLoading }) {
  const labels = ['Pending', 'Confirmed', 'Delivered', 'Returned', 'Cancelled'];
  const colors = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#6B7280'];
  const series = (Array.isArray(data) ? data : []).map((v) => (v == null || isNaN(v) ? 0 : Number(v)));
  // Ensure series length matches labels
  const safeSeries = labels.map((_, i) => series[i] ?? 0);
  const total = safeSeries.reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-sm h-full">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900">Order Status</p>
        <p className="text-xs text-gray-400 mt-0.5">Distribution by status</p>
      </div>
      <div className="p-5 flex justify-center items-center">
        {isLoading ? (
          <div className="w-36 h-36 bg-gray-50 rounded-md animate-pulse" />
        ) : total === 0 ? (
          <div className="h-52 flex items-center justify-center flex-col gap-2 text-gray-300">
            <MdShoppingBag size={36} />
            <p className="text-sm">No order data yet</p>
          </div>
        ) : (
          <SvgDonut series={safeSeries} colors={colors} labels={labels} />
        )}
      </div>
    </div>
  );
}

// ── Best sellers table ────────────────────────────────────────────────────────
function BestSellers({ products, isLoading }) {
  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-bold text-gray-900">Best Selling Products</p>
          <p className="text-xs text-gray-400 mt-0.5">Top 5 by units sold</p>
        </div>
        <Link
          href="/products"
          className="text-xs font-semibold text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
        >
          All products <MdOpenInNew size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      ) : !products?.length ? (
        <div className="text-center py-12 text-gray-400 text-sm">No product data</div>
      ) : (
        <div className="overflow-x-auto">
          <GlobalTable className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Product
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Sold
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Stock
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p, i) => {
                const lowStock = p.stock < 10;
                return (
                  <tr key={p._id || i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                          {i + 1}
                        </span>
                        <p className="font-medium text-gray-800 text-sm line-clamp-1">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-gray-600 whitespace-nowrap">
                      <span className="font-semibold">
                        {BDT}
                        {fmt(p.priceSale || p.price)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{fmt(p.sold)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md ${lowStock ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}
                      >
                        {fmt(p.stock)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Link
                        href={`/products/${p.slug}`}
                        className="text-gray-400 hover:text-gray-700 transition-colors inline-flex"
                      >
                        <MdOpenInNew size={15} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </GlobalTable>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const settings = useSiteSettings();
  const { data: dashboard, isLoading } = useQuery('dashboard-analytics', api.adminDashboardAnalytics, {
    onError: (err) => toast.error(err.message || 'Failed to load dashboard analytics')
  });

  const d = dashboard?.data || {};
  const {
    dailyEarning,
    dailyOrders,
    totalUsers,
    totalProducts,
    totalPendingOrders,
    totalReturnOrders,
    incomeReport,
    ordersReport,
    bestSellingProducts
  } = d;

  const primary = settings.primaryColor || '#c8a96e';

  const topStats = [
    {
      label: "Today's Revenue",
      value: fmtBdt(dailyEarning),
      icon: MdAttachMoney,
      bg: 'bg-amber-100',
      color: 'text-amber-600',
      href: '/orders?status=delivered'
    },
    {
      label: "Today's Orders",
      value: fmt(dailyOrders),
      icon: MdShoppingBag,
      bg: 'bg-blue-100',
      color: 'text-blue-600',
      href: '/orders'
    },
    {
      label: 'Pending Orders',
      value: fmt(totalPendingOrders),
      icon: MdPendingActions,
      bg: 'bg-orange-100',
      color: 'text-orange-500',
      href: '/orders?status=pending'
    },
    {
      label: 'Returned Orders',
      value: fmt(totalReturnOrders),
      icon: MdUndo,
      bg: 'bg-red-100',
      color: 'text-red-500',
      href: '/orders?status=returned'
    }
  ];

  const bottomStats = [
    {
      label: 'Total Customers',
      value: fmt(totalUsers),
      icon: MdPeople,
      bg: 'bg-green-100',
      color: 'text-green-600',
      href: '/users'
    },
    {
      label: 'Total Products',
      value: fmt(totalProducts),
      icon: MdInventory2,
      bg: 'bg-sky-100',
      color: 'text-sky-600',
      href: '/products'
    }
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{fmtToday()}</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div className="hidden sm:block">
            {settings.email && (
              <p className="text-xs text-gray-400 flex items-center justify-end gap-1">
                <MdEmail size={12} /> {settings.email}
              </p>
            )}
            {settings.phone && (
              <p className="text-xs text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                <MdPhone size={12} /> {settings.phone}
              </p>
            )}
          </div>
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold shrink-0"
            style={{ backgroundColor: primary }}
          >
            <MdTrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {topStats.map((s) => (
          <StatCard key={s.label} {...s} isLoading={isLoading} />
        ))}
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {bottomStats.map((s) => (
          <StatCard key={s.label} {...s} isLoading={isLoading} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <IncomeChart income={incomeReport} primaryColor={primary} isLoading={isLoading} />
        <OrderDonut data={ordersReport} isLoading={isLoading} />
      </div>

      {/* Best sellers */}
      <BestSellers products={bestSellingProducts} isLoading={isLoading} />
    </div>
  );
}
