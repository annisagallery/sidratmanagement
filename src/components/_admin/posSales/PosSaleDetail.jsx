'use client';

import { useParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { MdArrowBack, MdChevronLeft, MdChevronRight, MdPointOfSale } from 'react-icons/md';

import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { fDateTime } from 'src/utils/formatTime';

const fmtMoney = (amount) =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(amount || 0);

/**
 * POS counter sale detail — mirrors the POS terminal's order view (customer /
 * status / attribution cards + receipt-style item and totals table) instead of
 * the fulfillment-heavy admin order page.
 */
export default function PosSaleDetail() {
  const { orderNo } = useParams();
  const router = useRouter();
  const { data, isLoading } = useQuery(['admin-pos-sale', orderNo], () => api.getOrderByAdmin(orderNo), {
    enabled: Boolean(orderNo)
  });
  const sale = data?.data;

  if (isLoading) return <p className="p-8 text-center text-sm text-slate-400">Loading…</p>;
  if (!sale) return <p className="p-8 text-center text-sm text-red-500">Sale not found.</p>;

  const paid = (sale.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`POS Sale #${sale.orderNo}`}
        subtitle={fDateTime(sale.createdAt)}
        icon={MdPointOfSale}
      >
        <button className="btn-ghost" onClick={() => router.push('/pos-sales')}>
          <MdArrowBack size={16} /> All sales
        </button>
        {sale.previousOrder && (
          <Link href={`/pos-sales/${sale.previousOrder}`} className="btn-ghost" title="Previous sale">
            <MdChevronLeft size={16} /> Prev
          </Link>
        )}
        {sale.nextOrder && (
          <Link href={`/pos-sales/${sale.nextOrder}`} className="btn-ghost" title="Next sale">
            Next <MdChevronRight size={16} />
          </Link>
        )}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-ui p-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Customer</h3>
          <p className="text-sm font-semibold text-slate-800">{sale.shippingAddress?.name || sale.user?.name || 'Walk-in'}</p>
          <p className="text-sm text-slate-500">{sale.shippingAddress?.phone || sale.user?.phone || '—'}</p>
          {sale.user?.phone && (
            <Link href={`/users/${encodeURIComponent(sale.user.phone)}`} className="mt-1 inline-block text-xs text-slate-500 underline hover:text-slate-800">
              View customer
            </Link>
          )}
        </div>
        <div className="card-ui p-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Status</h3>
          <p className="text-sm capitalize text-slate-800">
            Sale: <b>{sale.status}</b>
          </p>
          <p className="text-sm capitalize text-slate-800">
            Payment: <b>{sale.paymentStatus}</b> ({sale.paymentMethod})
          </p>
          <p className="text-sm text-slate-500">Source: {sale.source}</p>
        </div>
        <div className="card-ui p-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Attribution</h3>
          <p className="text-sm text-slate-800">Sold by: <b>{sale.createdBy?.name || '—'}</b></p>
          <p className="text-sm text-slate-500">Warehouse: {sale.branch?.name || '—'}</p>
          {sale.branch?.bin && <p className="text-sm text-slate-500">BIN: {sale.branch.bin}</p>}
        </div>
      </div>

      <div className="card-ui overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Item</th>
              <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
              <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Returned</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(sale.items || []).map((item) => (
              <tr key={item._id}>
                <td className="px-3 py-2 text-[13px] text-slate-700">
                  {item.productSnapshot?.name || item.pid?.name || '—'}
                  {item.attributes?.length > 0 && (
                    <span className="block text-[11px] text-slate-400">
                      {item.attributes.map((a) => a.valueName).filter(Boolean).join(' / ')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-[13px]">{item.quantity}</td>
                <td className="px-3 py-2 text-center text-[13px]">{item.returnedQty || 0}</td>
                <td className="px-3 py-2 text-right text-[13px]">{fmtMoney(item.price)}</td>
                <td className="px-3 py-2 text-right text-[13px] font-semibold">{fmtMoney(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 border-t border-slate-200 p-3 text-right text-sm">
          <p>Subtotal: <b>{fmtMoney(sale.subTotal)}</b></p>
          {sale.discount > 0 && <p>Discount: <b>-{fmtMoney(sale.discount)}</b></p>}
          {sale.vat > 0 && <p>VAT ({sale.vatPercent}%): <b>{fmtMoney(sale.vat)}</b></p>}
          <p className="text-base">Total: <b className="text-[var(--brand-strong)]">{fmtMoney(sale.total)}</b></p>
          <p className="text-slate-500">Paid: {fmtMoney(paid)}</p>
        </div>
      </div>

      {(sale.payments || []).length > 0 && (
        <div className="card-ui p-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Payments</h3>
          <div className="space-y-1">
            {sale.payments.map((p, i) => (
              <div key={p._id || i} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-600">
                  {p.method === 'exchange-credit' ? 'Exchange credit' : p.method}
                  {p.note && <span className="ml-2 text-xs text-slate-400">{p.note}</span>}
                </span>
                <span className="font-semibold text-slate-800">{fmtMoney(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
