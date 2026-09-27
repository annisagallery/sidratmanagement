'use client';
import { useState, useEffect, useRef } from 'react';
import { MdClose, MdSearch } from 'react-icons/md';
import { toastSuccess, alertError } from 'src/utils/swal';
import { adminAdjustCash, getUserCashList } from 'src/services';
import { Field, ModalShell, fieldClass } from 'src/components/_admin/ui/primitives';
import Segmented from 'src/components/_admin/ui/Segmented';

const BDT = '৳';
const initials = (name) => name?.slice(0, 2)?.toUpperCase() || '?';

/**
 * Credit or debit a customer's cashback balance. Opened from the cashback
 * balances list (search for the customer) or from a customer's page (`user`
 * given, fixed).
 */
export default function CashModal({ prefilledUser = null, user: fixedUser = null, onClose, onDone }) {
  const locked = prefilledUser || fixedUser;
  const [user, setUser] = useState(locked);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ type: 'manual_credit', amount: '', message: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  const isCredit = form.type === 'manual_credit';
  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  useEffect(() => {
    if (locked) return undefined;
    if (!search.trim()) {
      setResults([]);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await getUserCashList(1, search.trim());
        setResults(r.data?.slice(0, 6) || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, locked]);

  const selectUser = (u) => {
    setUser(u);
    setSearch('');
    setResults([]);
    setErrors((p) => ({ ...p, user: undefined }));
  };

  const submit = async () => {
    const next = {};
    if (!user) next.user = 'Choose the customer first.';
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Enter an amount greater than zero.';
    if (!form.message.trim()) next.message = 'Say why — it is shown in the customer’s history.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await adminAdjustCash({
        userId: user.id,
        amount: Number(form.amount),
        type: form.type,
        message: form.message.trim()
      });
      toastSuccess(`${BDT}${Number(form.amount).toLocaleString()} ${isCredit ? 'credited to' : 'debited from'} ${user.name}`);
      onDone?.();
      onClose();
    } catch (err) {
      alertError(err, { title: 'The balance was not changed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Adjust cashback"
      subtitle="Cashback balance"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} className={isCredit ? 'btn-brand' : 'btn-danger'}>
            {saving ? 'Saving…' : isCredit ? 'Credit balance' : 'Debit balance'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {user ? (
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 ring-1 ring-slate-200" aria-hidden>
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-[13px] text-slate-500">
                {user.phone ? `${user.phone} · ` : ''}Balance{' '}
                <span className="font-semibold tabular-nums text-slate-900">
                  {BDT}
                  {(user.cash || 0).toLocaleString()}
                </span>
              </p>
            </div>
            {!locked && (
              <button
                aria-label="Choose a different customer"
                title="Choose a different customer"
                type="button"
                onClick={() => setUser(null)}
                className="btn-icon btn-icon-sm"
              >
                <MdClose size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Field label="Customer" error={errors.user}>
              <span className="relative block">
                <MdSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone"
                  className={`${fieldClass} pl-9`}
                  autoFocus
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-autocomplete="list"
                />
              </span>
            </Field>
            {(results.length > 0 || searching) && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl" role="listbox">
                {searching ? (
                  <div className="px-4 py-3 text-[13px] text-slate-500">Searching…</div>
                ) : (
                  results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => selectUser(u)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700" aria-hidden>
                        {initials(u.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{u.name}</span>
                        <span className="block text-xs text-slate-500">
                          {u.phone} · {BDT}
                          {(u.cash || 0).toLocaleString()}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-slate-800">Change</p>
          <Segmented
            label="Credit or debit"
            options={[
              { id: 'manual_credit', label: 'Add to balance' },
              { id: 'manual_debit', label: 'Take from balance' }
            ]}
            value={form.type}
            onChange={(type) => setForm((p) => ({ ...p, type }))}
          />
        </div>

        <Field label={`Amount (${BDT})`} required error={errors.amount}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.amount}
            onChange={set('amount')}
            placeholder="e.g. 50"
            className={`${fieldClass} tabular-nums`}
            aria-invalid={Boolean(errors.amount)}
            autoFocus={Boolean(locked)}
          />
        </Field>

        <Field label="Reason" required error={errors.message}>
          <input
            value={form.message}
            onChange={set('message')}
            placeholder="e.g. Goodwill for a delayed delivery"
            className={fieldClass}
            aria-invalid={Boolean(errors.message)}
          />
        </Field>
      </div>
    </ModalShell>
  );
}
