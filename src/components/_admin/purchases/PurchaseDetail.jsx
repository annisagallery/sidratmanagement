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
import { alertError, confirmDelete, promptText, toastSuccess } from 'src/utils/swal';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';
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
  getPurchasePaymentOptions,
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
  fieldClass,
  money,
  oid,
  qty
} from 'src/components/_admin/ui/primitives';
import { variationLabel } from 'src/components/_admin/inventory/shared';
import { PaymentStatusPill, PurchaseStatusPill, dueOf, outstandingUnits } from './shared';

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// A purchase is paid from HQ cash or an HQ payment method (and one of its
// accounts). The "Paid from" select holds 'cash' or 'method:<id>'.
const EMPTY_PAYMENT = { amount: '', source: '', paymentAccount: '', reference: '', note: '' };
const paymentPayload = (payment) =>
  payment.source === 'cash'
    ? { via: 'cash' }
    : { via: 'method', paymentMethod: payment.source.slice('method:'.length), paymentAccount: payment.paymentAccount };

export default function PurchaseDetail({ id }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const settings = useSiteSettings();

  const purchaseQuery = useQuery(['purchase', id], () => getPurchase(id));
  const purchase = purchaseQuery.data?.data;

  const [receiveDraft, setReceiveDraft] = useState({});
  const [payment, setPayment] = useState(EMPTY_PAYMENT);
  const optionsQuery = useQuery(['purchase-payment-options'], getPurchasePaymentOptions, { staleTime: 60_000 });
  const paymentOptions = optionsQuery.data?.data;
  const chosenMethod = payment.source.startsWith('method:')
    ? paymentOptions?.methods?.find((method) => method.id === payment.source.slice('method:'.length))
    : null;
  const methodAccounts = (chosenMethod?.accounts || []).filter(Boolean);

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
        toastSuccess(response?.message || 'Stock received');
        setReceiveDraft({});
        queryClient.invalidateQueries(['purchase', id]);
        queryClient.invalidateQueries('purchases');
        queryClient.invalidateQueries('inventory-transactions');
      },
      onError: (error) => alertError(error, { title: 'The stock could not be received' })
    }
  );

  const pay = useMutation(
    () => addPurchasePayment({ id, amount: num(payment.amount), reference: payment.reference, note: payment.note, ...paymentPayload(payment) }),
    {
    onSuccess: () => {
      toastSuccess('Payment recorded');
      setPayment(EMPTY_PAYMENT);
      queryClient.invalidateQueries(['purchase', id]);
      queryClient.invalidateQueries('purchases');
      queryClient.invalidateQueries(['purchase-payment-options']);
    },
    onError: (error) => alertError(error, { title: 'The payment could not be recorded' })
    }
  );
  const paymentReady = num(payment.amount) > 0 && payment.source && (!methodAccounts.length || payment.paymentAccount);

  const removePayment = useMutation((paymentId) => deletePurchasePayment({ id, paymentId }), {
    onSuccess: () => {
      toastSuccess('Payment removed');
      queryClient.invalidateQueries(['purchase', id]);
    },
    onError: (error) => alertError(error, { title: 'The payment could not be removed' })
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
      toastSuccess('Purchase voided', result?.message);
    },
    onError: (error) => alertError(error, { title: 'The purchase could not be voided' })
  });

  const confirmVoid = async () => {
    const received = (purchase.items || []).reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0);
    const reason = await promptText({
      tone: 'danger',
      title: `Void ${purchase.purchaseNo}?`,
      text: received
        ? `${received} unit${received === 1 ? '' : 's'} already received will be taken back off ${purchase.branch?.name || 'the warehouse'}. Anything sold since cannot be, and the void will be refused if so.`
        : 'Nothing has been received against it, so the order is simply withdrawn.',
      label: 'Reason (optional)',
      placeholder: 'e.g. ordered in error',
      required: false,
      multiline: false,
      confirmText: 'Void purchase'
    });
    if (reason !== null) voidIt.mutate(reason);
  };

  const printOrder = () =>
    printPurchaseOrder(purchase, settings).catch((error) =>
      alertError(error, { title: 'The purchase order could not be printed' })
    );

  if (purchaseQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-ui h-[104px] animate-pulse" />
          ))}
        </div>
        <div className="card-ui h-72 animate-pulse" />
      </div>
    );
  }
  if (purchaseQuery.isError && !purchase) {
    return <ErrorState error={purchaseQuery.error} title="This purchase could not be loaded" onRetry={purchaseQuery.refetch} />;
  }
  if (!purchase) {
    return (
      <div className="card-ui">
        <EmptyState
          title="Purchase not found"
          hint="It may have been removed."
          action={
            <button type="button" onClick={() => router.push('/purchases')} className="btn-ghost">
              Back to purchases
            </button>
          }
        />
      </div>
    );
  }

  const confirmRemovePayment = async (row) => {
    const confirmed = await confirmDelete({
      title: 'Remove this payment?',
      subject: `${money(row.amount)} by ${row.method}${row.reference ? ` · ${row.reference}` : ''}`,
      text: 'The amount goes back onto what is owed for this purchase.',
      confirmText: 'Remove payment',
      recoverable: false
    });
    if (confirmed) removePayment.mutate(oid(row));
  };

  return (
    <div className="space-y-6">
      <PageBar
        eyebrow="Purchases"
        title={purchase.purchaseNo}
        subtitle={`${purchase.refNo ? `${purchase.refNo} · ` : ''}into ${purchase.branch?.name || 'an unknown warehouse'}`}
        back={() => router.push('/purchases')}
      >
        <PurchaseStatusPill status={purchase.status} />
        <PaymentStatusPill status={purchase.paymentStatus} />
        <button type="button" onClick={printOrder} className="btn-ghost">
          <FiPrinter size={14} aria-hidden /> Print
        </button>
        {untouched && purchase.status !== 'CANCELLED' ? (
          <button type="button" onClick={() => router.push(`/purchases/${id}/edit`)} className="btn-ghost">
            <FiEdit2 size={14} aria-hidden /> Edit
          </button>
        ) : null}
        {/* Void stays available after receiving — that is the case it exists
            for. Only an already-cancelled purchase has nothing to withdraw. */}
        {purchase.status !== 'CANCELLED' ? (
          <ActionMenu
            label={`More actions for ${purchase.purchaseNo}`}
            items={[
              {
                label: voidIt.isLoading ? 'Voiding…' : 'Void purchase…',
                icon: FiSlash,
                tone: 'danger',
                onClick: confirmVoid,
                disabled: voidIt.isLoading
              }
            ]}
          />
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
                        <span className="ops-code ml-2 text-xs text-slate-500">#{item.product.code}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.variation ? variationLabel(item.variation) : 'Base product'}
                      {item.salePrice ? ` · shelf ${money(item.salePrice)}` : ' · unpriced'}
                    </p>
                  </td>
                  <td className="text-right tabular-nums text-slate-600">{money(item.unitCost)}</td>
                  <td className="text-right font-semibold tabular-nums text-slate-800">{qty(item.quantity)}</td>
                  <td className={`text-right font-semibold tabular-nums ${left > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
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
                        <span className="text-xs font-medium text-emerald-700">All received</span>
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
                className="btn-brand mt-3 w-full"
              >
                <FiInbox size={15} aria-hidden /> {receive.isLoading ? 'Receiving…' : 'Receive into stock'}
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
              <th>Paid from</th>
              <th>Reference</th>
              <th>Recorded by</th>
              <th className="text-right">Amount</th>
              <th className="w-10">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {purchase.payments?.length ? (
              purchase.payments.map((row) => (
                <tr key={oid(row)}>
                  <td className="whitespace-nowrap text-slate-600">
                    {row.paidAt ? format(new Date(row.paidAt), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="text-slate-700">{row.method}</td>
                  <td className="ops-code text-[12px] text-slate-500">{row.reference || '—'}</td>
                  <td className="text-[12px] text-slate-600">{row.createdBy?.name || 'System'}</td>
                  <td className="text-right font-semibold tabular-nums text-slate-800">{money(row.amount)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => confirmRemovePayment(row)}
                      disabled={removePayment.isLoading}
                      className="btn-icon btn-icon-sm btn-icon-danger"
                      aria-label={`Remove the ${money(row.amount)} payment`}
                      title="Remove payment"
                    >
                      <FiTrash2 size={14} aria-hidden />
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
            <div className="grid gap-3 md:grid-cols-[140px_200px_180px_1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-800">Amount</span>
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
                <span className="mb-1.5 block text-[13px] font-medium text-slate-800">Paid from</span>
                <select
                  value={payment.source}
                  onChange={(event) => setPayment((current) => ({ ...current, source: event.target.value, paymentAccount: '' }))}
                  className={fieldClass}
                >
                  <option value="">Choose…</option>
                  <option value="cash">
                    HQ Cash{paymentOptions ? ` (${money(paymentOptions.cashBalance)} in hand)` : ''}
                  </option>
                  {(paymentOptions?.methods || []).map((method) => (
                    <option key={method.id} value={`method:${method.id}`}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-800">Account</span>
                <select
                  value={payment.paymentAccount}
                  onChange={(event) => setPayment((current) => ({ ...current, paymentAccount: event.target.value }))}
                  disabled={!methodAccounts.length}
                  className={fieldClass}
                >
                  <option value="">{methodAccounts.length ? 'Choose the account…' : 'No accounts'}</option>
                  {methodAccounts.map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-800">Reference</span>
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
                  disabled={pay.isLoading || !paymentReady}
                  className="btn-brand w-full md:w-auto"
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
