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
  const { data, isLoading, error } = useQuery('report-catalog', getReportCatalog);
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
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Generate, filter and export business reports" icon={FiBarChart2}>
        <div className="relative">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a report…"
            className="input-ui w-64 pl-9"
          />
        </div>
      </PageHeader>

      {isLoading && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-md border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <div className="card-ui px-6 py-16 text-center">
          <p className="font-medium text-slate-700">Reports unavailable</p>
          <p className="mt-1 text-sm text-slate-500">
            {error?.response?.data?.message || 'Check the reporting API and try again.'}
          </p>
        </div>
      )}

      {!isLoading && !error && !groups.length && (
        <div className="card-ui px-6 py-16 text-center">
          <p className="font-medium text-slate-700">No matching reports</p>
          <p className="mt-1 text-sm text-slate-500">Try a broader name or business area.</p>
        </div>
      )}

      {groups.map(([category, items]) => (
        <section key={category}>
          <div className="mb-2.5 flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-900">{category}</h2>
            <span className="text-xs text-slate-400">{items.length}</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((report) => {
              const Icon = ICONS[report.key] || FiBarChart2;
              return (
                <Link
                  key={report.key}
                  href={`/reports/${report.key}`}
                  className="group card-ui flex items-start gap-3.5 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{report.label}</span>
                      <FiArrowUpRight
                        size={15}
                        className="shrink-0 text-slate-300 transition group-hover:text-[var(--brand-strong)]"
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{report.description}</span>
                    <span className="mt-2 block text-[11px] font-medium text-slate-400">
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
