'use client';
import { useState } from 'react';
import { useMutation } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';

export default function AddPaymentModal({ types = [], onClose, onDone }) {
  const [form, setForm] = useState({ type: types[0]?.slug || '', amount: '', trxId: '', account: '', note: '' });

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const { mutate, isLoading } = useMutation(() => api.createPaymentByAdmin({ ...form, amount: Number(form.amount) }), {
    onSuccess: () => {
      Swal.fire({ title: 'Payment added', icon: 'success', timer: 1200, showConfirmButton: false });
      onDone();
      onClose();
    },
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const submit = () => {
    if (!form.type) return Swal.fire('Select payment type', '', 'warning');
    if (!form.amount || Number(form.amount) <= 0) return Swal.fire('Enter amount', '', 'warning');
    if (!form.note.trim()) return Swal.fire('Note is required for manual payments', '', 'warning');
    mutate();
  };

  const inp =
    'border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-[var(--brand)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-md shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 text-base">Add Manual Payment</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select value={form.type} onChange={set('type')} className={inp}>
              {types.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <input type="number" min="0" value={form.amount} onChange={set('amount')} placeholder="0" className={inp} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Transaction ID</label>
          <input value={form.trxId} onChange={set('trxId')} placeholder="Optional" className={inp} />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Account</label>
          <input
            value={form.account}
            onChange={set('account')}
            placeholder="Receiving account number"
            className={inp}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Note <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.note}
            onChange={set('note')}
            rows={2}
            placeholder="Required — reason for manual entry"
            className={`${inp} resize-none`}
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-md transition">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isLoading}
            className="px-5 py-2 bg-[var(--brand)] hover:brightness-95 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
          >
            {isLoading ? 'Adding…' : 'Add Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
