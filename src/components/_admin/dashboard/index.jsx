'use client';
import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { MdArrowForward, MdShoppingBag, MdTrendingUp } from 'react-icons/md';
import * as api from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Panel, { SectionHeading } from 'src/components/_admin/ui/Panel';
import Segmented from 'src/components/_admin/ui/Segmented';
import Badge from 'src/components/_admin/ui/Badge';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';
import { KpiGrid, LinkTile } from 'src/components/_admin/ui/kpi';

const BDT = '৳';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (n) => (n ?? 0).toLocaleString('en-US');
const fmtBdt = (n) => BDT + fmt(n);
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const linkClass = 'inline-flex items-center gap-1 text-[13px] font-medium text-slate-700 hover:text-slate-900 hover:underline';

/** A clean axis top: four equal steps of 1/2/2.5/5 × 10ⁿ. */
function niceMax(value) {
  if (value <= 0) return 4;
  const raw = value / 4;
  const exponent = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].find((m) => m * exponent >= raw) * exponent);
  return step * 4;
}

// ── Revenue columns (no third-party deps) ────────────────────────────────────
function BarChart({ data, categories }) {
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(...data, 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  // show every nth label to avoid crowding
  const step = data.length <= 12 ? 1 : Math.ceil(data.length / 10);
  const height = 220;

  return (
    <div>
      <div className="flex">
        <div className="relative mr-2 w-12 shrink-0" style={{ height }} aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-xs tabular-nums text-slate-500"
              style={{ bottom: `${(tick / max) * 100}%` }}
            >
              {BDT}
              {compact.format(tick)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }} onMouseLeave={() => setHover(null)}>
          {ticks.map((tick) => (
            <div
              key={tick}
              className={`absolute inset-x-0 border-t ${tick === 0 ? 'border-slate-300' : 'border-dashed border-slate-200'}`}
              style={{ bottom: `${(tick / max) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((v, i) => (
              <button
                key={i}
                type="button"
                className="flex h-full flex-1 items-end justify-center rounded-sm"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${categories[i]}: ${fmtBdt(v)}`}
              >
                <span
                  className="block w-full max-w-[28px] rounded-t-[3px] transition-opacity"
                  style={{
                    height: v > 0 ? `max(2px, ${(v / max) * 100}%)` : 0,
                    backgroundColor: 'var(--brand-chart)',
                    opacity: hover === null || hover === i ? 1 : 0.4
                  }}
                />
              </button>
            ))}
          </div>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={
                hover < data.length / 2
                  ? { left: `${((hover + 1) / data.length) * 100}%`, marginLeft: 8 }
                  : { right: `${((data.length - hover) / data.length) * 100}%`, marginRight: 8 }
              }
            >
              <p className="font-semibold text-slate-900">{categories[hover]}</p>
              <p className="tabular-nums text-slate-600">{fmtBdt(data[hover])}</p>
            </div>
          )}
        </div>
      </div>
      <div className="ml-14 mt-2 flex h-4 gap-[2px]" aria-hidden>
        {categories.map((label, i) => (
          <span key={i} className="relative flex-1 text-xs text-slate-500">
            {i % step === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{label}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── SVG donut chart (no third-party deps) ────────────────────────────────────
function SvgDonut({ series, colors, labels }) {
  const total = series.reduce((a, b) => a + b, 0);
  const r = 52,
    cx = 68,
    cy = 68,
    sw = 20;
  const circumference = 2 * Math.PI * r;

  const { segments } = series.reduce(
    (result, v, i) => {
      const dash = total > 0 ? (v / total) * circumference : 0;
      return {
        consumed: result.consumed + dash,
        segments: [...result.segments, { dash, offset: circumference - result.consumed, color: colors[i], label: labels[i], v }]
      };
    },
    { consumed: 0, segments: [] }
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 136 136" width={148} height={148} role="img" aria-label={`${total} orders by status`}>
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
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
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="600" fill="#0f172a">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#64748b">
          orders
        </text>
      </svg>

      <ul className="w-full divide-y divide-slate-100 text-[13px]">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2 py-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="truncate text-slate-600">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-900">{fmt(s.v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Income chart panel ────────────────────────────────────────────────────────
function IncomeChart({ income, isLoading }) {
  const [period, setPeriod] = useState('week');

  const categories = useMemo(() => {
    if (period === 'year') return MONTHS;
    if (period === 'month') return Array.from({ length: 31 }, (_, i) => String(i + 1));
    return [...Array(7).keys()].map((d) =>
      new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(Date.now() - 86400000 * (6 - d)))
    );
  }, [period]);

  const rawData = Array.isArray(income?.[period]) ? income[period] : [];
  const data = categories.map((_, i) => {
    const v = rawData[i];
    return v == null || isNaN(v) ? 0 : Number(v);
  });
  const hasData = data.some((v) => v > 0);

  return (
    <Panel
      title="Revenue"
      description="Income over time. Hover or focus a bar for the exact amount."
      action={
        <Segmented
          label="Period"
          options={[
            { id: 'week', label: '7 days' },
            { id: 'month', label: '30 days' },
            { id: 'year', label: '12 months' }
          ]}
          value={period}
          onChange={setPeriod}
        />
      }
    >
      {isLoading ? (
        <div className="skeleton h-[244px] w-full" />
      ) : !hasData ? (
        <EmptyState compact icon={MdTrendingUp} title="No revenue in this period" />
      ) : (
        <BarChart data={data} categories={categories} />
      )}
    </Panel>
  );
}

// ── Order donut panel ─────────────────────────────────────────────────────────
function OrderDonut({ data, isLoading }) {
  const labels = ['Pending', 'Confirmed', 'Delivered', 'Returned', 'Cancelled'];
  const colors = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#94A3B8'];
  const series = (Array.isArray(data) ? data : []).map((v) => (v == null || isNaN(v) ? 0 : Number(v)));
  // Ensure series length matches labels
  const safeSeries = labels.map((_, i) => series[i] ?? 0);
  const total = safeSeries.reduce((a, b) => a + b, 0);

  return (
    <Panel title="Order status" description="All orders by their current status.">
      {isLoading ? (
        <div className="flex flex-col items-center gap-5">
          <div className="skeleton h-36 w-36 rounded-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      ) : total === 0 ? (
        <EmptyState compact icon={MdShoppingBag} title="No orders yet" />
      ) : (
        <SvgDonut series={safeSeries} colors={colors} labels={labels} />
      )}
    </Panel>
  );
}

// ── Best sellers table ────────────────────────────────────────────────────────
function BestSellers({ products, isLoading }) {
  return (
    <section className="card-ui overflow-hidden" aria-labelledby="best-sellers-title">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pb-4 pt-5">
        <div>
          <h2 id="best-sellers-title" className="text-[15px] font-semibold text-slate-900">
            Best-selling products
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Top 5 by units sold.</p>
        </div>
        <Link href="/products" className={linkClass}>
          All products <MdArrowForward size={14} aria-hidden />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-5 pb-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-9 w-full" />
          ))}
        </div>
      ) : !products?.length ? (
        <EmptyState compact title="No sales yet" />
      ) : (
        <GlobalTable>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col" className="text-right">
                Price
              </th>
              <th scope="col" className="text-right">
                Sold
              </th>
              <th scope="col" className="text-right">
                Stock
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => {
              const lowStock = p.stock < 10;
              return (
                <tr key={p.id || i}>
                  <td>
                    <Link href={`/products/${p.slug}`} className="flex items-center gap-3 hover:underline">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                        {i + 1}
                      </span>
                      <span className="line-clamp-1 font-medium text-slate-900">{p.name}</span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums text-slate-700">{fmtBdt(p.priceSale || p.price)}</td>
                  <td className="text-right font-semibold tabular-nums text-slate-900">{fmt(p.sold)}</td>
                  <td className="text-right">
                    {lowStock ? (
                      <Badge tone="danger" dot>
                        {fmt(p.stock)} · Low
                      </Badge>
                    ) : (
                      <span className="tabular-nums text-slate-700">{fmt(p.stock)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </GlobalTable>
      )}
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: dashboard, isLoading, isError, error, refetch } = useQuery('dashboard-analytics', api.adminDashboardAnalytics);

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

  if (isError && !dashboard) {
    return <ErrorState error={error} title="The dashboard could not be loaded" onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">

      <section className="space-y-3">
        <SectionHeading title="Today" description="Select a figure to open the orders behind it." />
        <KpiGrid>
          <LinkTile href="/orders?status=delivered" label="Today's revenue" value={fmtBdt(dailyEarning)} loading={isLoading} />
          <LinkTile href="/orders" label="Today's orders" value={fmt(dailyOrders)} loading={isLoading} />
          <LinkTile href="/orders?status=pending" label="Pending orders" value={fmt(totalPendingOrders)} loading={isLoading} />
          <LinkTile href="/orders?status=returned" label="Returned orders" value={fmt(totalReturnOrders)} loading={isLoading} />
        </KpiGrid>
        <KpiGrid columns={2}>
          <LinkTile href="/users" size="sm" label="Total customers" value={fmt(totalUsers)} loading={isLoading} />
          <LinkTile href="/products" size="sm" label="Total products" value={fmt(totalProducts)} loading={isLoading} />
        </KpiGrid>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <IncomeChart income={incomeReport} isLoading={isLoading} />
        <OrderDonut data={ordersReport} isLoading={isLoading} />
      </div>

      <BestSellers products={bestSellingProducts} isLoading={isLoading} />
    </div>
  );
}
