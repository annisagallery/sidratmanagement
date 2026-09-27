'use client';

/**
 * Every purchase, newest first — the old POS's purchase list.
 *
 * Its columns are the ones that list had, because they are the questions a
 * buyer actually asks it: when, which challan, where to, how much, how much of
 * that is paid, and what is still owed. Balance is a column rather than a
 * calculation the reader does, since chasing what is owed is most of what this
 * screen is opened for.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import { MdAdd, MdLocalShipping, MdShoppingBag } from 'react-icons/md';

import { adminGetBranches, getPurchases } from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { KpiGrid, StatTile } from 'src/components/_admin/ui/kpi';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { money, oid, qty } from 'src/components/_admin/ui/primitives';
import { PURCHASE_STATUS, PAYMENT_STATUS, PaymentStatusPill, PurchaseStatusPill, dueOf, outstandingUnits } from './shared';

const EMPTY_FILTERS = { search: '', status: '', paymentStatus: '', branch: '' };

export default function PurchaseList() {
  const router = useRouter();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const patch = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const purchasesQuery = useQuery(
    ['purchases', filters, page],
    () =>
      getPurchases({
        page,
        limit,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
      }),
    { keepPreviousData: true }
  );
  const branchesQuery = useQuery('inventory-branches', adminGetBranches);

  const rows = purchasesQuery.data?.data || [];
  const branches = branchesQuery.data?.data || [];
  const filtered = Object.values(filters).some(Boolean);

  // Totals for the page in view, not for all time — this is a working list, and
  // a lifetime figure here would be a number nobody could act on.
  const pageTotal = rows.reduce((sum, row) => sum + Number(row.grandTotal || 0), 0);
  const pageDue = rows.reduce((sum, row) => sum + dueOf(row), 0);
  const awaiting = rows.filter((row) => outstandingUnits(row) > 0 && row.status !== 'CANCELLED').length;

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (row) => <span className="whitespace-nowrap text-slate-600">{row.date ? format(new Date(row.date), 'dd MMM yyyy') : '—'}</span>
    },
    {
      key: 'purchaseNo',
      label: 'Reference',
      render: (row) => (
        <div>
          <p className="ops-code text-[13px] font-semibold text-slate-900">{row.purchaseNo}</p>
          {row.refNo ? <p className="text-xs text-slate-500">Challan {row.refNo}</p> : null}
        </div>
      )
    },
    {
      key: 'branch',
      label: 'Warehouse',
      hideBelow: 'md',
      render: (row) => <span className="text-slate-700">{row.branch?.name || '—'}</span>
    },
    {
      key: 'status',
      label: 'Delivery',
      render: (row) => {
        const outstanding = outstandingUnits(row);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <PurchaseStatusPill status={row.status} />
            {outstanding > 0 && row.status !== 'CANCELLED' ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-800">
                <MdLocalShipping size={14} aria-hidden /> {qty(outstanding)} to come
              </span>
            ) : null}
          </div>
        );
      }
    },
    {
      key: 'grandTotal',
      label: 'Total',
      align: 'right',
      render: (row) => <span className="font-semibold tabular-nums text-slate-900">{money(row.grandTotal)}</span>
    },
    {
      key: 'paidAmount',
      label: 'Paid',
      align: 'right',
      hideBelow: 'lg',
      render: (row) => <span className="tabular-nums text-slate-600">{money(row.paidAmount)}</span>
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right',
      render: (row) => {
        const due = dueOf(row);
        return <span className={`font-semibold tabular-nums ${due > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{money(due)}</span>;
      }
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      hideBelow: 'sm',
      render: (row) => <PaymentStatusPill status={row.paymentStatus} />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Purchases" subtitle="Stock bought in finished — bags, and anything else the workshop does not make.">
        <Link href="/purchases/create" className="btn-brand">
          <MdAdd size={18} aria-hidden /> Add purchase
        </Link>
      </PageHeader>

      <KpiGrid columns={3}>
        <StatTile
          label="On this page"
          value={money(pageTotal)}
          hint={`${rows.length} purchase${rows.length === 1 ? '' : 's'}`}
          loading={purchasesQuery.isLoading}
        />
        <StatTile label="Still owed" value={money(pageDue)} hint="Across the purchases shown" loading={purchasesQuery.isLoading} />
        <StatTile label="Awaiting delivery" value={qty(awaiting)} hint="Purchases with units still to arrive" loading={purchasesQuery.isLoading} />
      </KpiGrid>

      <ListToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSubmit={() => patch('search', searchInput.trim())}
        searchPlaceholder="PO number, challan or note…"
        onRefresh={() => purchasesQuery.refetch()}
        refreshing={purchasesQuery.isFetching}
        onReset={
          filtered || searchInput
            ? () => {
                setFilters(EMPTY_FILTERS);
                setSearchInput('');
                setPage(1);
              }
            : undefined
        }
      >
        <select value={filters.status} onChange={(event) => patch('status', event.target.value)} className="select-ui" aria-label="Delivery status">
          <option value="">Any delivery status</option>
          {Object.entries(PURCHASE_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select value={filters.paymentStatus} onChange={(event) => patch('paymentStatus', event.target.value)} className="select-ui" aria-label="Payment status">
          <option value="">Any payment status</option>
          {Object.entries(PAYMENT_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select value={filters.branch} onChange={(event) => patch('branch', event.target.value)} className="select-ui" aria-label="Warehouse">
          <option value="">All warehouses</option>
          {branches.map((branch) => (
            <option key={oid(branch)} value={oid(branch)}>
              {branch.name}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        caption="Purchases"
        columns={columns}
        data={rows}
        rowKey={(row) => oid(row)}
        onRowClick={(row) => router.push(`/purchases/${oid(row)}`)}
        rowLabel={(row) => `Open purchase ${row.purchaseNo}`}
        selectable={false}
        isLoading={purchasesQuery.isLoading}
        isFetching={purchasesQuery.isFetching}
        error={purchasesQuery.isError ? purchasesQuery.error : null}
        onRetry={purchasesQuery.refetch}
        empty={
          filtered ? (
            <EmptyState title="No purchases match" hint="Try another filter or clear the search." />
          ) : (
            <EmptyState
              icon={MdShoppingBag}
              title="No purchases yet"
              hint="Raise one when you order stock the workshop does not make."
              action={
                <Link href="/purchases/create" className="btn-brand">
                  <MdAdd size={18} aria-hidden /> Add purchase
                </Link>
              }
            />
          )
        }
        footer={
          <Pagination
            page={page}
            totalPages={purchasesQuery.data?.count || 1}
            onPage={setPage}
            total={purchasesQuery.data?.total || 0}
            unit="purchases"
            pageSize={limit}
          />
        }
      />
    </div>
  );
}
