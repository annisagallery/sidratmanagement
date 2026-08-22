'use client';

/**
 * One purchase: what was ordered, what has actually arrived, and what is still
 * owed for it.
 *
 * The two acts this page exists for are receiving and paying, and they are kept
 * apart because they are apart in real life — goods usually land before the
 * invoice is settled, sometimes in instalments, occasionally not at all.
 *
 * Who it was bought from is the challan number, not a record: the reference off
 * the seller's own paperwork is what anyone actually looks a purchase up by.
 *
 * Receiving is the only thing on this screen that touches stock. Each line
 * offers what is still outstanding, pre-filled but editable, because a supplier
 * sends what they have rather than what the order said.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import {
  FiCreditCard,
  FiEdit2,
  FiInbox,
  FiPackage,
  FiPrinter,
  FiSlash,
  FiTrash2,
  FiTruck
} from 'react-icons/fi';

import {
  addPurchasePayment,
  deletePurchasePayment,
  getPurchase,
  receivePurchase,
  voidPurchase
} from 'src/services';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import { printPurchaseOrder } from 'src/components/_admin/documents/openStockDocuments';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import {
  CellInput,
  DocketTotalRow
} from 'src/components/_admin/ui/docket';
import {
  EmptyRow,
  Notice,
  PageBar,
  Row,
  Section,
  SectionBody,
  StatTile,
  errorAlert,
  fieldClass,
  money,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { variationLabel } from 'src/components/_admin/inventory/shared';
import { PaymentStatusPill, PurchaseStatusPill, dueOf, outstandingUnits } from './shared';

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const METHODS = ['cash', 'bank', 'bkash', 'nagad', 'cheque', 'other'];

export default function PurchaseDetail({ id }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const settings = useSiteSettings();

  const purchaseQuery = useQuery(['purchase', id], () => getPurchase(id));
  const purchase = purchaseQuery.data?.data;

  const [receiveDraft, setReceiveDraft] = useState({});
  const [payment, setPayment] = useState({ amount: '', method: 'cash', reference: '', note: '' });

  const items = useMemo(() => purchase?.items || [], [purchase]);
  const due = dueOf(purchase);
  const outstanding = outstandingUnits(purchase);
  const canReceive = purchase && !['CANCELLED', 'RECEIVED'].includes(purchase.status) && outstanding > 0;
  const untouched = items.every((item) => Number(item.receivedQuantity || 0) === 0);

  // Pre-filled with what is outstanding, so the common case — everything
  // arrived — is one button and no typing.
  const receiveValue = (item) => {
    const key = item.id;
    const left = num(item.quantity) - num(item.receivedQuantity);
    return receiveDraft[key] === undefined ? left : receiveDraft[key];
  };

  const receive = useMutation(
    () =>
      receivePurchase({
        id,
        lines: items
          .map((item) => ({ itemId: item.id, quantity: num(receiveValue(item)) }))
          .filter((line) => line.quantity > 0)
      }),
    {
      onSuccess: (response) => {
        toast(response?.message || 'Stock received');
        setReceiveDraft({});
        queryClient.invalidateQueries(['purchase', id]);
        queryClient.invalidateQueries('purchases');
        queryClient.invalidateQueries('inventory-transactions');
      },
      onError: (error) => errorAlert('The stock could not be received', error)
    }
  );

  const pay = useMutation(() => addPurchasePayment({ id, ...payment, amount: num(payment.amount) }), {
    onSuccess: () => {
      toast('Payment recorded');
      setPayment({ amount: '', method: 'cash', reference: '', note: '' });
      queryClient.invalidateQueries(['purchase', id]);
      queryClient.invalidateQueries('purchases');
    },
    onError: (error) => errorAlert('The payment could not be recorded', error)
  });

  const removePayment = useMutation((paymentId) => deletePurchasePayment({ id, paymentId }), {
    onSuccess: () => {
      toast('Payment removed');
      queryClient.invalidateQueries(['purchase', id]);
    },
    onError: (error) => errorAlert('The payment could not be removed', error)
  });

  /**
   * Voiding, rather than cancelling.
   *
   * One action for both situations, because to the person doing it there is
   * only one: this purchase should not stand. Nothing received and it simply
   * withdraws; stock already received and it comes back off the shelf too.
   *
   * If any of that stock has since been sold the server refuses the whole
   * thing rather than half-applying it, and says what is in the way — a
   * purchase half-unwound would read as cancelled while the stock said
   * otherwise.
   */
  const voidIt = useMutation((reason) => voidPurchase({ id, reason }), {
    onSuccess: (result) => {
      queryClient.invalidateQueries(['purchase', id]);
      queryClient.invalidateQueries('purchases');
      queryClient.invalidateQueries('inventory-transactions');
      queryClient.invalidateQueries('inventory-product-stock');
      Swal.fire({ icon: 'success', title: 'Purchase voided', text: result?.message, confirmButtonText: 'Done' });
    },
    onError: (error) => errorAlert('The purchase could not be voided', error)
  });

  const confirmVoid = async () => {
    const received = (purchase.items || []).reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0);
    const { isConfirmed, value } = await Swal.fire({
      title: `Void ${purchase.purchaseNo}?`,
      text: received
        ? `${received} unit${received === 1 ? '' : 's'} already received will be taken back off ${purchase.branch?.name || 'the warehouse'}. Anything sold since cannot be, and the void will be refused if so.`
        : 'Nothing has been received against it, so the order is simply withdrawn.',
      icon: 'warning',
      input: 'text',
      inputLabel: 'Reason (optional)',
      inputPlaceholder: 'Ordered in error…',
      showCancelButton: true,
      confirmButtonText: 'Void it',
      cancelButtonText: 'Keep it'
    });
    if (isConfirmed) voidIt.mutate(value || '');
  };

  const printOrder = () =>
    printPurchaseOrder(purchase, settings).catch((error) =>
      errorAlert('The purchase order could not be printed', error)
    );

  if (purchaseQuery.isLoading) {
    return <p className="p-8 text-sm text-slate-400">Loading purchase…</p>;
  }
  if (!purchase) {
    return (
      <Notice tone="bad" title="Purchase not found">
        It may have been removed.
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Purchases"
        title={purchase.purchaseNo}
        subtitle={`${purchase.refNo ? `${purchase.refNo} · ` : ''}into ${purchase.branch?.name || 'an unknown warehouse'}`}
        back={() => router.push('/purchases')}
      >
        <PurchaseStatusPill status={purchase.status} />
        <PaymentStatusPill status={purchase.paymentStatus} />
        <button type="button" onClick={printOrder} className="btn-ghost">
          <FiPrinter size={14} /> Print
        </button>
        {untouched && purchase.status !== 'CANCELLED' ? (
          <button type="button" onClick={() => router.push(`/purchases/${id}/edit`)} className="btn-ghost">
            <FiEdit2 size={14} /> Edit
          </button>
        ) : null}
        {/* Void stays available after receiving — that is the case it exists
            for. Only an already-cancelled purchase has nothing to withdraw. */}
        {purchase.status !== 'CANCELLED' ? (
          <button type="button" onClick={confirmVoid} disabled={voidIt.isLoading} className="btn-ghost !text-rose-600">
            <FiSlash size={14} /> {voidIt.isLoading ? 'Voiding…' : 'Void'}
          </button>
        ) : null}
      </PageBar>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Grand total" value={money(purchase.grandTotal)} />
        <StatTile label="Paid" value={money(purchase.paidAmount)} tone="good" />
        <StatTile label="Balance" value={money(due)} tone={due > 0 ? 'warn' : 'good'} />
        <StatTile
          label="Still to arrive"
          value={qty(outstanding)}
          tone={outstanding > 0 ? 'info' : 'muted'}
          note={outstanding > 0 ? 'units outstanding' : 'everything received'}
        />
      </div>

      {!untouched && purchase.status !== 'RECEIVED' ? (
        <Notice tone="info" icon={FiTruck} title="Part of this delivery has arrived">
          The lines are locked to what was ordered now — receiving the rest is the only change left. Anything the
          supplier got wrong is a return, not an edit.
        </Notice>
      ) : null}

      <Section title="Ordered" icon={FiPackage} hint={`${items.length} line${items.length === 1 ? '' : 's'}`}>
        <GlobalTable>
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">Unit cost</th>
              <th className="text-right">Ordered</th>
              <th className="text-right">Received</th>
              <th className="text-right">Subtotal</th>
              {canReceive ? <th className="w-32 text-right">Receive now</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const left = num(item.quantity) - num(item.receivedQuantity);
              return (
                <tr key={item.id}>
                  <td>
                    <p className="font-medium text-slate-800">
                      {item.product?.name || 'Unknown product'}
                      {item.product?.code ? (
                        <span className="ops-code ml-2 text-[11px] text-slate-400">#{item.product.code}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {item.variation ? variationLabel(item.variation) : 'Base product'}
                      {item.salePrice ? ` · shelf ${money(item.salePrice)}` : ' · unpriced'}
                    </p>
                  </td>
                  <td className="text-right tabular-nums text-slate-600">{money(item.unitCost)}</td>
                  <td className="text-right font-semibold tabular-nums text-slate-800">{qty(item.quantity)}</td>
                  <td className={`text-right font-semibold tabular-nums ${left > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {qty(item.receivedQuantity)}
                  </td>
                  <td className="text-right font-semibold tabular-nums text-slate-800">{money(item.subTotal)}</td>
                  {canReceive ? (
                    <td className="text-right">
                      {left > 0 ? (
                        <CellInput
                          value={receiveValue(item)}
                          min={0}
                          width="w-20"
                          onChange={(value) =>
                            setReceiveDraft((current) => ({ ...current, [item.id]: Math.min(num(value), left) }))
                          }
                        />
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-700">Complete</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </GlobalTable>

        <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-[1fr_320px]">
          <dl className="space-y-0">
            <Row label="Date" value={purchase.date ? format(new Date(purchase.date), 'dd MMM yyyy') : null} />
            <Row label="Challan / invoice no" value={purchase.refNo} mono />
            <Row label="Raised by" value={purchase.createdBy?.name} />
            <Row
              label="Received by"
              value={purchase.receivedBy?.name ? `${purchase.receivedBy.name}${purchase.receivedAt ? ` · ${format(new Date(purchase.receivedAt), 'dd MMM yyyy')}` : ''}` : null}
            />
            <Row label="Note" value={purchase.note} />
          </dl>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-4">
            <DocketTotalRow label="Items" value={purchase.subTotal} />
            <DocketTotalRow label="Order discount" value={-num(purchase.orderDiscount)} />
            <DocketTotalRow label="Order tax" value={num(purchase.orderTax)} />
            <DocketTotalRow label="Shipping" value={num(purchase.shipping)} />
            <DocketTotalRow label="Grand total" value={purchase.grandTotal} strong />

            {canReceive ? (
              <button
                type="button"
                onClick={() => receive.mutate()}
                disabled={receive.isLoading}
                className="btn-brand mt-3 h-11 w-full"
              >
                <FiInbox size={15} /> {receive.isLoading ? 'Receiving…' : 'Receive into stock'}
              </button>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Payments" icon={FiCreditCard} hint={due > 0 ? `${money(due)} still owed` : 'Settled'}>
        <GlobalTable>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Recorded by</th>
              <th className="text-right">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {purchase.payments?.length ? (
              purchase.payments.map((row) => (
                <tr key={oid(row)}>
                  <td className="whitespace-nowrap text-[12px] text-slate-500">
                    {row.paidAt ? format(new Date(row.paidAt), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="capitalize text-slate-700">{row.method}</td>
                  <td className="ops-code text-[12px] text-slate-500">{row.reference || '—'}</td>
                  <td className="text-[12px] text-slate-600">{row.createdBy?.name || 'System'}</td>
                  <td className="text-right font-semibold tabular-nums text-slate-800">{money(row.amount)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => removePayment.mutate(oid(row))}
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove this payment"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={6} title="Nothing paid yet" hint="Record a payment below as the invoice is settled." />
            )}
          </tbody>
        </GlobalTable>

        {due > 0 ? (
          <SectionBody className="border-t border-slate-200 p-4">
            <div className="grid gap-3 md:grid-cols-[140px_140px_1fr_auto]">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Amount</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={due}
                  value={payment.amount}
                  onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))}
                  placeholder={String(due)}
                  className={`${fieldClass} text-right tabular-nums`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Method</span>
                <select
                  value={payment.method}
                  onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}
                  className={`${fieldClass} capitalize`}
                >
                  {METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Reference</span>
                <input
                  value={payment.reference}
                  onChange={(event) => setPayment((current) => ({ ...current, reference: event.target.value }))}
                  placeholder="Cheque number, transaction id…"
                  className={fieldClass}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => pay.mutate()}
                  disabled={pay.isLoading || num(payment.amount) <= 0}
                  className="btn-brand h-[38px] w-full md:w-auto"
                >
                  {pay.isLoading ? 'Saving…' : 'Record payment'}
                </button>
              </div>
            </div>
          </SectionBody>
        ) : null}
      </Section>
    </div>
  );
}
