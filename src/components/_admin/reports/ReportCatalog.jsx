'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import {
  FiArrowUpRight,
  FiBarChart2,
  FiSearch,
  FiShoppingCart,
  FiPackage,
  FiRotateCcw,
  FiAlertCircle,
  FiBox,
  FiLayers,
  FiRepeat,
  FiStar,
  FiUsers,
  FiCreditCard,
  FiDollarSign,
  FiTag,
  FiShare2
} from 'react-icons/fi';
import { MdOutlineInventory2, MdOutlineLocalShipping } from 'react-icons/md';
import { HiOutlineSpeakerphone } from 'react-icons/hi';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { getReportCatalog } from 'src/services';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';

const ICONS = {
  sales: FiShoppingCart,
  'order-items': FiPackage,
  'pos-returns': FiRotateCcw,
  complaints: FiAlertCircle,
  products: FiBox,
  inventory: MdOutlineInventory2,
  'inventory-transactions': FiRepeat,
  'stock-transfers': FiLayers,
  reviews: FiStar,
  customers: FiUsers,
  payments: FiCreditCard,
  cashback: FiDollarSign,
  coupons: FiTag,
  campaigns: HiOutlineSpeakerphone,
  shipments: FiShare2
};

const CATEGORY_ORDER = ['Sales', 'Catalog', 'Inventory', 'Customers', 'Finance', 'Marketing', 'Shipping'];

export default function ReportCatalog() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error, refetch } = useQuery('report-catalog', getReportCatalog);
  const reports = data?.data || [];

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = reports.filter(
      (r) => !query || `${r.label} ${r.description} ${r.category}`.toLowerCase().includes(query)
    );
    const map = filtered.reduce((acc, r) => {
      (acc[r.category] = acc[r.category] || []).push(r);
      return acc;
    }, {});
    return CATEGORY_ORDER.filter((c) => map[c]?.length).map((c) => [c, map[c]]);
  }, [reports, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Filter, run and export reports on every part of the business." />

      <div className="relative max-w-sm">
        <FiSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a report…"
          aria-label="Find a report"
          className="input-ui pl-9"
        />
      </div>

      {isLoading && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="card-ui h-28 animate-pulse" />
          ))}
        </div>
      )}

      {isError && <ErrorState error={error} title="Reports could not be loaded" onRetry={refetch} />}

      {!isLoading && !isError && !groups.length && (
        <div className="card-ui">
          <EmptyState icon={FiBarChart2} title="No report matches" hint="Try a broader name or business area." />
        </div>
      )}

      {groups.map(([category, items]) => (
        <section key={category}>
          <div className="mb-2.5 flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-slate-900">{category}</h2>
            <span className="text-[13px] text-slate-500">{items.length}</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((report) => {
              const Icon = ICONS[report.key] || FiBarChart2;
              return (
                <Link
                  key={report.key}
                  href={`/reports/${report.key}`}
                  className="group card-ui flex items-start gap-3.5 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    <Icon size={17} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{report.label}</span>
                      <FiArrowUpRight size={15} className="shrink-0 text-slate-400 transition group-hover:text-slate-900" aria-hidden />
                    </span>
                    <span className="mt-1 block text-[13px] leading-5 text-slate-600">{report.description}</span>
                    <span className="mt-2 block text-xs font-medium text-slate-500">
                      {report.filters.length} filters · {report.columns.length} columns
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
