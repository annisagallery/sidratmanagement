'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiAlertTriangle, FiCheckCircle, FiCopy, FiPlus, FiX } from 'react-icons/fi';

import { Drawer } from 'src/components/_admin/ui/primitives';

// Advance payments for an order being raised, in a side panel.
//
// Pick the method, type the amount and (for anything but cash) the
// transaction ID. The ID is checked against what actually arrived:
//   matched   → added verified
//   unmatched → saved unverified (not received yet, or it disagrees)
//   duplicate → saved unverified (the ID already pays another order)
// Cash has no ID and is always unverified. The server checks again on save.
//
// Self-contained on purpose: the branch order form uses the same panel, so the
// data calls come in as props (loadOptions, checkTrx) rather than imports.

const money = (n) => `৳${Number(n || 0).toLocaleString('en-BD')}`;
let keySeq = 0;
const nextKey = () => `adv-${Date.now()}-${(keySeq += 1)}`;
const normTrx = (value) => String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const field =
  'flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 transition focus-within:!border-[var(--brand-strong)] focus-within:shadow-[0_0_0_3px_var(--brand-ring)]';
const control = 'h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none';
const label = 'shrink-0 text-xs text-slate-500';

/** The check result in one short line. */
function describeCheck(result) {
  if (!result) return null;
  const captured = result.captured;
  if (result.status === 'matched') {
    const time = captured?.at ? new Date(captured.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
    return { tone: 'match', text: ['Matched', `${money(captured?.amount)}${captured?.senderAccount ? ` from ${captured.senderAccount}` : ''}`, time].filter(Boolean).join(' · ') };
  }
  if (result.status === 'duplicate') {
    return { tone: 'duplicate', text: result.usedBy?.orderNo ? `Duplicate · on #${result.usedBy.orderNo}` : 'Duplicate · already used' };
  }
  const reasons = result.reasons || [];
  if (reasons.includes('amount_mismatch')) return { tone: 'unmatched', text: `Amount differs · ${money(captured?.amount)} received` };
  if (reasons.includes('method_mismatch')) return { tone: 'unmatched', text: `Different wallet · ${captured?.type || 'other'}` };
  return { tone: 'unmatched', text: 'Not received yet' };
}

const TONE = {
  match: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: FiCheckCircle, icon: 'text-emerald-600' },
  unmatched: { box: 'border-amber-200 bg-amber-50 text-amber-900', Icon: FiAlertTriangle, icon: 'text-amber-600' },
  duplicate: { box: 'border-rose-200 bg-rose-50 text-rose-900', Icon: FiCopy, icon: 'text-rose-600' },
};

export default function AdvancePaymentsPanel({ value, onChange, onClose, orderTotal = 0, loadOptions, checkTrx }) {
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState('');
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [trxId, setTrxId] = useState('');
  const [note, setNote] = useState('');
  const [check, setCheck] = useState({ loading: false, result: null, error: '' });
  const checkSeq = useRef(0);
  const amountRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadOptions()
      .then((res) => active && setOptions(res?.data || []))
      .catch((error) => active && setOptionsError(error?.response?.data?.message || 'Payment methods could not be loaded.'));
    return () => {
      active = false;
    };
  }, [loadOptions]);

  const option = useMemo(() => options?.find((o) => o.method === method) || null, [options, method]);
  const needsTrx = Boolean(option?.needsTrxId);
  const amountNumber = Number(amount);
  const amountOk = Number.isFinite(amountNumber) && amountNumber > 0;
  const trxClean = normTrx(trxId);
  const alreadyListed = needsTrx && trxClean && value.some((entry) => normTrx(entry.trxId) === trxClean);

  // Check the transaction ID as it is typed (debounced), and again when the
  // amount or method changes — the match depends on all three.
  useEffect(() => {
    setCheck({ loading: false, result: null, error: '' });
    if (!needsTrx || trxClean.length < 6 || !amountOk || alreadyListed) return undefined;
    const id = (checkSeq.current += 1);
    setCheck({ loading: true, result: null, error: '' });
    const timer = setTimeout(() => {
      checkTrx({ trxId: trxId.trim(), amount: amountNumber, method })
        .then((res) => id === checkSeq.current && setCheck({ loading: false, result: res?.data || null, error: '' }))
        .catch((error) =>
          id === checkSeq.current &&
          setCheck({ loading: false, result: null, error: error?.response?.data?.message || 'Could not check this ID.' })
        );
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, trxClean, amountNumber, needsTrx, alreadyListed]);

  const status = !option ? null : !needsTrx ? 'cash' : alreadyListed ? 'listed' : check.result?.status || null;
  const ready = Boolean(option && amountOk && (!needsTrx || (trxClean && check.result && !check.loading && !alreadyListed)));
  const described = describeCheck(check.result);

  const pickMethod = (next) => {
    setMethod(next);
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  const add = () => {
    if (!ready) return;
    const matched = status === 'matched';
    onChange([
      ...value,
      {
        key: nextKey(),
        method: option.method,
        methodName: option.name,
        color: option.color,
        amount: amountNumber,
        trxId: needsTrx ? trxId.trim() : null,
        note: note.trim() || null,
        status: needsTrx ? status : 'cash',
        reasons: check.result?.reasons || [],
        usedBy: check.result?.usedBy || null,
        verified: matched,
        // Anything but a match goes in only because staff chose to save it.
        force: !matched,
      },
    ]);
    // Ready for the next payment with the same method.
    setAmount('');
    setTrxId('');
    setNote('');
    setCheck({ loading: false, result: null, error: '' });
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  const total = value.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const verifiedTotal = value.filter((entry) => entry.verified).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const due = Math.max(0, Number(orderTotal || 0) - total);
  const addLabel = status === 'matched' ? 'Add verified' : needsTrx ? 'Save unverified' : 'Add · unverified';

  return (
    <Drawer
      title="Advance"
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="space-y-3">
          <dl className="space-y-1 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-slate-500">Advance</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {verifiedTotal !== total ? <span className="mr-1.5 text-xs font-normal text-slate-500">{money(verifiedTotal)} verified ·</span> : null}
                {money(total)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">To collect</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{money(due)}</dd>
            </div>
          </dl>
          <button type="button" className="btn-brand h-10 w-full" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Add a payment */}
        <section className="space-y-2.5">
          {optionsError ? (
            <p className="text-[13px] font-medium text-rose-700" role="alert">
              {optionsError}
            </p>
          ) : !options ? (
            <p className="text-[13px] text-slate-500">Loading…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Payment method">
              {options.map((o) => {
                const active = o.method === method;
                return (
                  <button
                    key={o.method}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickMethod(o.method)}
                    title={o.accounts?.length ? o.accounts.join(', ') : undefined}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition ${
                      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color || '#94a3b8' }} aria-hidden />
                    {o.name}
                  </button>
                );
              })}
            </div>
          )}

          {option ? (
            <>
              <label className={field}>
                <span className={label}>Amount ৳</span>
                <input
                  ref={amountRef}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                  className={`${control} text-right tabular-nums`}
                />
              </label>
              {needsTrx ? (
                <label className={field}>
                  <span className={label}>Transaction ID</span>
                  <input
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && add()}
                    spellCheck={false}
                    className={`${control} ops-code uppercase`}
                  />
                </label>
              ) : null}
              <label className={field}>
                <span className={label}>Note</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={control} />
              </label>

              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1" aria-live="polite">
                  {alreadyListed ? (
                    <p className="text-[13px] font-medium text-rose-700">Already in the list</p>
                  ) : check.loading ? (
                    <p className="flex items-center gap-2 text-[13px] text-slate-500">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" aria-hidden /> Checking…
                    </p>
                  ) : check.error ? (
                    <p className="text-[13px] font-medium text-rose-700" role="alert">
                      {check.error}
                    </p>
                  ) : described ? (
                    (() => {
                      const tone = TONE[described.tone];
                      return (
                        <p className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[13px] font-medium ${tone.box}`}>
                          <tone.Icon size={14} className={`shrink-0 ${tone.icon}`} aria-hidden />
                          <span className="truncate">{described.text}</span>
                        </p>
                      );
                    })()
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={add}
                  disabled={!ready}
                  className={`shrink-0 ${status === 'matched' || !needsTrx ? 'btn-brand btn-sm' : 'btn-ghost btn-sm !border-amber-300 !text-amber-800'}`}
                >
                  <FiPlus size={14} aria-hidden /> {addLabel}
                </button>
              </div>
            </>
          ) : null}
        </section>

        {/* Payments on this order */}
        <section>
          <h3 className="section-label mb-2">Payments{value.length ? ` · ${value.length}` : ''}</h3>
          {value.length ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {value.map((entry) => (
                <li key={entry.key} className="flex items-center gap-3 px-3 py-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color || '#94a3b8' }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900">
                      {entry.methodName || entry.method}
                      {entry.trxId ? <span className="ml-2 font-mono text-xs font-normal text-slate-500">{entry.trxId}</span> : null}
                    </p>
                    <p className={`text-xs ${entry.verified ? 'text-emerald-700' : 'text-amber-700'}`} title={entry.usedBy?.orderNo ? `Also on order #${entry.usedBy.orderNo}` : undefined}>
                      {entry.verified ? 'Verified' : entry.status === 'duplicate' ? 'Unverified · duplicate' : entry.status === 'unmatched' ? 'Unverified · not matched' : 'Unverified'}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums text-slate-900">{money(entry.amount)}</span>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((x) => x.key !== entry.key))}
                    aria-label={`Remove ${entry.methodName || entry.method} payment of ${money(entry.amount)}`}
                    className="btn-icon btn-icon-sm btn-icon-danger -mr-1"
                  >
                    <FiX size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-500">No advance yet.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}

AdvancePaymentsPanel.propTypes = {
  value: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  orderTotal: PropTypes.number,
  loadOptions: PropTypes.func.isRequired,
  checkTrx: PropTypes.func.isRequired,
};
