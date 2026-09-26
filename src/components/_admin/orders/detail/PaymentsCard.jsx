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
  FiCreditCard,
  FiPlus,
  FiRotateCcw,
  FiSlash,
  FiTrash2,
  FiTruck,
  FiXCircle
} from 'react-icons/fi';

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
    return { key: 'void', label: status === 'failed' ? 'Failed' : 'Rejected', icon: FiXCircle, cls: 'text-rose-600' };
  }
  if (payment.method === 'cod') return { key: 'courier', label: 'With courier', icon: FiTruck, cls: 'text-sky-700' };
  return { key: 'pending', label: 'Needs check', icon: FiClock, cls: 'text-amber-700' };
}

const sum = (list) => list.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);

/* ── collection summary ─────────────────────────────────────────────────── */

const SEGMENTS = [
  { key: 'verified', label: 'Verified', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'pending', label: 'Needs check', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  { key: 'courier', label: 'With courier', bar: 'bg-sky-500', dot: 'bg-sky-500' },
  { key: 'open', label: 'Not received', bar: 'bg-transparent', dot: 'border border-slate-300 bg-white' }
];

function Collection({ total, due, amounts }) {
  const base = Math.max(total, amounts.verified + amounts.pending + amounts.courier, 1);
  const onTheWay = amounts.pending + amounts.courier;
  const shown = SEGMENTS.filter((segment) => amounts[segment.key] > 0);

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">Collected</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
            {money(amounts.verified)}
            <span className="ml-1.5 text-sm font-medium text-slate-500">of {money(total)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-500">{due > 0 ? 'Balance due' : 'Balance'}</p>
          <p className={`mt-0.5 text-lg font-bold tabular-nums ${due > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {money(due)}
          </p>
          {due > 0 && onTheWay > 0 ? (
            <p className="text-xs text-slate-500">{money(Math.min(onTheWay, due))} on its way</p>
          ) : null}
        </div>
      </div>

      <div
        className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={shown.map((segment) => `${segment.label} ${money(amounts[segment.key])}`).join(', ')}
      >
        {SEGMENTS.slice(0, 3).map((segment) =>
          amounts[segment.key] > 0 ? (
            <span
              key={segment.key}
              className={`${segment.bar} h-full border-r border-white last:border-r-0`}
              style={{ width: `${(amounts[segment.key] / base) * 100}%` }}
            />
          ) : null
        )}
      </div>

      {shown.length > 1 || amounts.open > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {shown.map((segment) => (
            <li key={segment.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`h-2 w-2 rounded-full ${segment.dot}`} aria-hidden="true" />
              {segment.label}
              <span className="font-semibold tabular-nums text-slate-900">{money(amounts[segment.key])}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── one payment ────────────────────────────────────────────────────────── */

function PaymentRow({ payment, onRemove, onVerify }) {
  const method = methodOf(payment.method);
  const state = stateOf(payment);
  const StateIcon = state.icon;
  const voided = state.key === 'void' || state.key === 'refunded';

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${voided ? 'opacity-40' : ''}`}
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
            <StateIcon size={12} aria-hidden="true" />
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
            <button
              type="button"
              onClick={() => onVerify(oid(payment), 'verified')}
              className="btn-ghost h-8 !border-emerald-200 !px-3 !text-xs !text-emerald-700 hover:!bg-emerald-50"
            >
              <FiCheck size={13} /> Verify
            </button>
            <button
              type="button"
              onClick={() => onVerify(oid(payment), 'rejected')}
              className="btn-ghost h-8 !border-rose-200 !px-3 !text-xs !text-rose-600 hover:!bg-rose-50"
            >
              <FiSlash size={13} /> Reject
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onRemove(oid(payment))}
        aria-label={`Remove ${money(payment.amount)} ${method.label} payment`}
        title="Remove payment"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
      >
        <FiTrash2 size={14} />
      </button>
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
      <span className={`tabular-nums ${strong ? 'text-sm font-bold text-slate-900' : `text-[13px] ${tone}`}`}>
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
  const verified = paid;
  const pending = sum(byState('pending'));
  const courier = sum(byState('courier'));
  const amounts = {
    verified,
    pending,
    courier,
    open: Math.max(0, Math.round(total - verified - pending - courier))
  };

  return (
    <Card
      title="Payment"
      icon={FiCreditCard}
      badge={<PaymentBadge paid={paid} due={due} />}
      actions={
        <button
          type="button"
          onClick={onAdd}
          className={due > 0 ? 'btn-brand h-8 !px-3 !text-xs' : 'btn-ghost h-8 !px-3 !text-xs'}
        >
          <FiPlus size={14} /> Add payment
        </button>
      }
    >
      <Collection total={total} due={due} amounts={amounts} />

      <div className="border-t border-slate-100 px-5 pt-3">
        <p className="text-xs font-semibold text-slate-600">
          Transactions <span className="font-normal text-slate-500">· {sorted.length}</span>
        </p>
        {sorted.length ? (
          <ul className="divide-y divide-slate-100">
            {sorted.map((payment) => (
              <PaymentRow key={oid(payment)} payment={payment} onRemove={onRemove} onVerify={onVerify} />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-slate-500">No payments yet</p>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
        <Line label="Subtotal" sub={`${itemCount} item${itemCount === 1 ? '' : 's'}`} amount={order?.subTotal} />
        <Line
          label="Shipping"
          sub={DELIVERY_LABEL[order?.deliveryType] || order?.deliveryType}
          amount={order?.shipping}
        />
        {order?.discount > 0 ? (
          <Line label="Discount" sub={coupon} amount={order.discount} sign="−" tone="text-emerald-700" />
        ) : null}
        {order?.cashDiscount > 0 ? (
          <Line label="Sidrat Cash" amount={order.cashDiscount} sign="−" tone="text-emerald-700" />
        ) : null}
        {order?.vat > 0 ? <Line label="VAT" sub={`${order.vatPercent}%`} amount={order.vat} /> : null}
        <div className="border-t border-slate-200 pt-2">
          <Line label="Total" amount={total} strong />
        </div>
      </div>
    </Card>
  );
}
