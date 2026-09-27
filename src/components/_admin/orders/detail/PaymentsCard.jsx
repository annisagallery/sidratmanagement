'use client';

/**
 * The bill and the money received against it, in one card.
 *
 * Read top to bottom it answers, in order: how much is still owed, where the
 * money that has arrived stands (verified, waiting for a check, still with the
 * courier), which payments make that up, and what the bill was. Only verified
 * payments count toward what is paid — the server's rule — but money that is
 * on its way is shown as such rather than left to look missing.
 */

import { format } from 'date-fns';
import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiPlus,
  FiRotateCcw,
  FiSlash,
  FiTrash2,
  FiTruck,
  FiXCircle
} from 'react-icons/fi';

import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { Card, CopyButton, PaymentBadge, money, oid } from './parts';

const DELIVERY_LABEL = { regular: 'Regular', urgent: 'Urgent', sameDay: 'Same day' };

// Wallet colours match the payment-method presets in Payment settings, so a
// bKash payment looks the same everywhere it appears.
const METHOD = {
  bkash: { label: 'bKash', color: '#E2136E' },
  nagad: { label: 'Nagad', color: '#EC1C24' },
  rocket: { label: 'Rocket', color: '#8C3494' },
  upay: { label: 'Upay', color: '#0A4DA2' },
  tap: { label: 'Tap', color: '#6A1B9A' },
  okwallet: { label: 'OK Wallet', color: '#D71920' },
  mcash: { label: 'mCash', color: '#00703C' },
  pathaopay: { label: 'Pathao Pay', color: '#C8102E' },
  cellfin: { label: 'Cellfin', color: '#0B6B3A' },
  cod: { label: 'Cash on delivery', color: '#475569' },
  cash: { label: 'Cash', color: '#047857' },
  card: { label: 'Card', color: '#4338CA' },
  bank: { label: 'Bank transfer', color: '#0F766E' },
  wallet: { label: 'Sidrat Cash', color: '#B45309' }
};

const methodOf = (value) => {
  const key = String(value || '').toLowerCase();
  const base = key.split(/[-_]/)[0];
  return METHOD[key] || METHOD[base] || { label: value || 'Other', color: '#64748b' };
};

// Where a single payment stands. Every state carries an icon and a word, never
// colour alone.
function stateOf(payment) {
  const status = payment.status || 'pending';
  if (status === 'verified')
    return { key: 'verified', label: 'Verified', icon: FiCheckCircle, cls: 'text-emerald-700' };
  if (status === 'refunded') return { key: 'refunded', label: 'Refunded', icon: FiRotateCcw, cls: 'text-slate-600' };
  if (status === 'rejected' || status === 'failed') {
    return { key: 'void', label: status === 'failed' ? 'Failed' : 'Rejected', icon: FiXCircle, cls: 'text-rose-700' };
  }
  if (payment.method === 'cod') return { key: 'courier', label: 'With courier', icon: FiTruck, cls: 'text-sky-700' };
  return { key: 'pending', label: 'Needs check', icon: FiClock, cls: 'text-amber-700' };
}

const sum = (list) => list.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);

/* ── one payment ────────────────────────────────────────────────────────── */

function PaymentRow({ payment, onRemove, onVerify }) {
  const method = methodOf(payment.method);
  const state = stateOf(payment);
  const StateIcon = state.icon;
  const voided = state.key === 'void' || state.key === 'refunded';

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white ${voided ? 'opacity-40' : ''}`}
        style={{ backgroundColor: method.color }}
        aria-hidden="true"
      >
        {method.label.charAt(0).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`text-sm font-semibold tabular-nums ${voided ? 'text-slate-500 line-through' : 'text-slate-900'}`}
          >
            {money(payment.amount)}
          </span>
          <span className="text-sm text-slate-600">{method.label}</span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${state.cls}`}>
            <StateIcon size={13} aria-hidden="true" />
            {state.label}
          </span>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
          {payment.createdAt ? <span>{format(new Date(payment.createdAt), 'dd MMM yyyy, hh:mm a')}</span> : null}
          {payment.trxId ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="ops-code text-slate-600">{payment.trxId}</span>
              <CopyButton value={payment.trxId} label="Copy transaction ID" />
            </>
          ) : null}
          {payment.note ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="min-w-0 truncate">{payment.note}</span>
            </>
          ) : null}
        </p>

        {state.key === 'pending' && onVerify ? (
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => onVerify(oid(payment), 'verified')} className="btn-ghost btn-sm">
              <FiCheck size={14} className="text-emerald-600" aria-hidden /> Verify
            </button>
            <button type="button" onClick={() => onVerify(oid(payment), 'rejected')} className="btn-ghost btn-sm !text-rose-700 hover:!bg-rose-50">
              <FiSlash size={14} aria-hidden /> Reject
            </button>
          </div>
        ) : null}
      </div>

      <ActionMenu
        label={`More actions for the ${money(payment.amount)} ${method.label} payment`}
        items={[{ label: 'Remove payment…', icon: FiTrash2, tone: 'danger', onClick: () => onRemove(oid(payment)) }]}
      />
    </li>
  );
}

/* ── bill ───────────────────────────────────────────────────────────────── */

function Line({ label, sub, amount, sign = '', tone = 'text-slate-900', strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`text-[13px] ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
        {label}
        {sub ? <span className="ml-2 text-xs text-slate-500">{sub}</span> : null}
      </span>
      <span className={`tabular-nums ${strong ? 'text-sm font-semibold text-slate-900' : `text-[13px] ${tone}`}`}>
        {sign}
        {money(amount)}
      </span>
    </div>
  );
}

export default function PaymentsCard({
  order,
  payments = [],
  total = 0,
  paid = 0,
  due = 0,
  onAdd,
  onRemove,
  onVerify
}) {
  const itemCount = (order?.items || []).length;
  const coupon = order?.couponCode || (typeof order?.coupon === 'string' ? order.coupon : null);

  // Oldest first, so the list reads as the order was paid.
  const sorted = [...payments].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
  const byState = (key) => sorted.filter((payment) => stateOf(payment).key === key);
  const needsCheck = sum(byState('pending'));
  const withCourier = sum(byState('courier'));
  const onTheWay = needsCheck + withCourier;

  return (
    <Card
      title="Payment"
      badge={<PaymentBadge paid={paid} due={due} />}
      actions={
        <button type="button" onClick={onAdd} className="btn-ghost btn-sm">
          <FiPlus size={14} aria-hidden /> Add payment
        </button>
      }
    >
      {/* The bill, then what has been paid against it. */}
      <div className="space-y-2 border-t border-slate-100 px-5 py-4">
        <Line label="Subtotal" sub={`${itemCount} item${itemCount === 1 ? '' : 's'}`} amount={order?.subTotal} />
        <Line label="Shipping" sub={DELIVERY_LABEL[order?.deliveryType] || order?.deliveryType} amount={order?.shipping} />
        {order?.discount > 0 ? <Line label="Discount" sub={coupon} amount={order.discount} sign="−" tone="text-emerald-700" /> : null}
        {order?.cashDiscount > 0 ? <Line label="Sidrat Cash" amount={order.cashDiscount} sign="−" tone="text-emerald-700" /> : null}
        {order?.vat > 0 ? <Line label="VAT" sub={`${order.vatPercent}%`} amount={order.vat} /> : null}
        <div className="border-t border-slate-200 pt-2">
          <Line label="Total" amount={total} strong />
        </div>
        <Line label="Paid" sub="Verified payments" amount={paid} />
        <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-2">
          <span className="text-sm font-semibold text-slate-900">{due > 0 ? 'Balance due' : 'Fully paid'}</span>
          <span className={`text-sm font-semibold tabular-nums ${due > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>{money(due)}</span>
        </div>
        {due > 0 && onTheWay > 0 ? (
          <p className="text-right text-xs text-slate-500">
            {needsCheck > 0 ? `${money(needsCheck)} waiting to be checked` : ''}
            {needsCheck > 0 && withCourier > 0 ? ' · ' : ''}
            {withCourier > 0 ? `${money(withCourier)} with the courier` : ''}
          </p>
        ) : null}
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        <p className="text-[13px] font-medium text-slate-900">
          Transactions <span className="font-normal text-slate-500">{sorted.length}</span>
        </p>
        {sorted.length ? (
          <ul className="divide-y divide-slate-100">
            {sorted.map((payment) => (
              <PaymentRow key={oid(payment)} payment={payment} onRemove={onRemove} onVerify={onVerify} />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-[13px] text-slate-500">No payments recorded yet.</p>
        )}
      </div>
    </Card>
  );
}
