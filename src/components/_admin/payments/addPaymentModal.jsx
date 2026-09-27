'use client';
import { useState } from 'react';
import { useMutation } from 'react-query';
import * as api from 'src/services';
import { toastSuccess, alertError } from 'src/utils/swal';
import { Field, ModalShell, fieldClass, selectClass } from 'src/components/_admin/ui/primitives';

/**
 * Record money that arrived outside the automatic channels. The note is
 * required because a manual entry is exactly what someone will audit later.
 */
export default function AddPaymentModal({ types = [], onClose, onDone }) {
  const [form, setForm] = useState({ type: types[0]?.slug || '', amount: '', trxId: '', account: '', note: '' });
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const { mutate, isLoading } = useMutation(() => api.createPaymentByAdmin({ ...form, amount: Number(form.amount) }), {
    onSuccess: () => {
      toastSuccess('Payment recorded');
      onDone();
      onClose();
    },
    onError: (e) => alertError(e, { title: 'The payment was not recorded' })
  });

  const submit = () => {
    const next = {};
    if (!form.type) next.type = 'Choose the payment type.';
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Enter an amount greater than zero.';
    if (!form.note.trim()) next.note = 'Say why this is entered by hand.';
    setErrors(next);
    if (Object.keys(next).length) return;
    mutate();
  };

  return (
    <ModalShell
      title="Add a manual payment"
      subtitle="Payments"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={isLoading}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={isLoading} className="btn-brand">
            {isLoading ? 'Recording…' : 'Record payment'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type" required error={errors.type}>
          <select value={form.type} onChange={set('type')} className={selectClass}>
            {!types.length ? <option value="">No payment types set up</option> : null}
            {types.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount (৳)" required error={errors.amount}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={form.amount}
            onChange={set('amount')}
            placeholder="0"
            className={`${fieldClass} tabular-nums`}
            aria-invalid={Boolean(errors.amount)}
            autoFocus
          />
        </Field>
        <Field label="Transaction ID" optional>
          <input value={form.trxId} onChange={set('trxId')} className={`${fieldClass} ops-code`} spellCheck={false} />
        </Field>
        <Field label="Receiving account" optional>
          <input value={form.account} onChange={set('account')} placeholder="Account or wallet number" className={fieldClass} />
        </Field>
        <Field label="Note" required error={errors.note} className="sm:col-span-2">
          <textarea
            value={form.note}
            onChange={set('note')}
            rows={2}
            placeholder="Why this payment is entered by hand"
            className={`${fieldClass} resize-none`}
            aria-invalid={Boolean(errors.note)}
          />
        </Field>
      </div>
    </ModalShell>
  );
}
