'use client';

import { useState } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import Swal from 'sweetalert2';
import { MdChevronRight, MdPointOfSale, MdReceiptLong } from 'react-icons/md';

import * as api from 'src/services';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import { printInvoices } from 'src/components/_admin/dispatch/openDocuments';
import DataTable from 'src/components/_admin/ui/DataTable';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDateTime } from 'src/utils/formatTime';

const PAYMENT_STYLE = {
  paid: 'bg-emerald-100 text-emerald-700',
  unpaid: 'bg-slate-100 text-slate-500',
  refunded: 'bg-amber-100 text-amber-700'
};

const fmtMoney = (amount) =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(amount || 0);

/**
 * POS counter sales — separate from the fulfillment Orders queue. These are
 * receipted at the till (born delivered + paid), so there is no status
 * pipeline here: just the sales ledger, filterable by warehouse.
 */
export default function PosSalesList() {
  const router = useRouter();
  const settings = useSiteSettings();
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: branchData } = useQuery('admin-branches', api.adminGetBranches);
  const branches = (branchData?.data || []).filter((b) => b.type !== 'HQ' && b.code !== 'HQ');

  const params = new URLSearchParams({
    page,
    limit,
    channel: 'pos',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...(search && { search }),
    ...(branch && { branch })
  }).toString();

  const { data, isLoading, isFetching } = useQuery(['admin-pos-sales', params], () => api.getOrdersByAdmin(params), {
    keepPreviousData: true,
    onError: (error) => Swal.fire(error?.response?.data?.message || 'Something went wrong!', '', 'error')
  });

  const sales = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;

  // Resolves false so the selection survives — printing changes nothing.
  const printSaleInvoices = async (rows) => {
    try {
      await printInvoices(rows, settings);
    } catch (error) {
      Swal.fire(error?.message || 'The invoices could not be built', '', 'error');
    }
    return false;
  };

  const columns = [
    {
      key: 'orderNo',
      label: 'Sale',
      render: (sale) => (
        <div className="min-w-[145px]">
          <span className="font-mono text-[13px] font-bold text-slate-900">#{sale.orderNo}</span>
          <div className="mt-1 text-[11px] text-slate-400">
            {sale.createdAt ? fDateTime(sale.createdAt) : '—'}
          </div>
        </div>
      )
    },
    {
      key: 'branch',
      label: 'Warehouse',
      render: (sale) => (
        <div className="min-w-[110px]">
          <div className="font-semibold text-slate-700">{sale.branch?.name || '—'}</div>
          {sale.branch?.code && <div className="mt-0.5 font-mono text-[11px] text-slate-400">{sale.branch.code}</div>}
        </div>
      )
    },
    {
      key: 'soldBy',
      label: 'Sold by',
      render: (sale) => <span className="font-semibold text-slate-700">{sale.createdBy?.name || '—'}</span>
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (sale) => (
        <div className="min-w-[140px]">
          <div className="font-semibold text-slate-800">
            {sale.shippingAddress?.name || sale.user?.name || 'Walk-in'}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">{sale.shippingAddress?.phone || sale.user?.phone || '—'}</div>
        </div>
      )
    },
    {
      key: 'items',
      label: 'Items',
      align: 'center',
      render: (sale) => <span className="font-semibold text-slate-700">{sale.items?.length || 0}</span>
    },
    {
      key: 'payment',
      label: 'Payment',
      render: (sale) => (
        <div>
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${PAYMENT_STYLE[sale.paymentStatus] || 'bg-slate-100 text-slate-500'}`}
          >
            {sale.paymentStatus || '—'}
          </span>
          <div className="mt-1.5 text-[11px] uppercase text-slate-400">{sale.paymentMethod || '—'}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (sale) => (
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${sale.status === 'returned' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
        >
          {sale.status}
        </span>
      )
    },
    {
      key: 'total',
      label: 'Amount',
      align: 'right',
      render: (sale) => <span className="whitespace-nowrap font-bold text-slate-900">{fmtMoney(sale.total)}</span>
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (sale) => (
        <button
          type="button"
          onClick={() => router.push(`/pos-sales/${sale.orderNo}`)}
          className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
          title="Open sale"
          aria-label={`Open POS sale ${sale.orderNo}`}
        >
          <MdChevronRight size={20} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Sales"
        subtitle={`${total} counter sale${total !== 1 ? 's' : ''} · receipted at the till, no fulfillment pipeline`}
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search sale no, customer or phone…"
        onReset={() => {
          setSearch('');
          setBranch('');
          setPage(1);
        }}
      >
        <select
          value={branch}
          onChange={(event) => {
            setBranch(event.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[170px] font-semibold"
          aria-label="Warehouse"
        >
          <option value="">All warehouses</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        columns={columns}
        data={sales}
        selectionLabel="sales"
        exportFileName="pos-sales-selection.csv"
        rowKey={(sale) => sale.orderNo}
        bulkActions={[
          {
            // No label action here: a counter sale leaves with the customer,
            // so there is nothing to ship and nothing to address.
            label: 'Print invoices',
            icon: MdReceiptLong,
            tone: 'neutral',
            hint: 'One invoice per A4 page, as a PDF in a new tab',
            onClick: printSaleInvoices
          }
        ]}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="No POS sales found" icon={MdPointOfSale} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="sales" />}
      />
    </div>
  );
}
