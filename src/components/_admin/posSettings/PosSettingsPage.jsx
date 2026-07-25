'use client';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getPosSettings, updatePosSettings } from 'src/services';
import Swal from 'sweetalert2';

function Card({ title, subtitle, children }) {
  return (
    <section className="bg-white border border-gray-100 rounded-md p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="font-semibold text-base text-gray-800">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function PosSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery('pos-settings', getPosSettings);

  const [form, setForm] = useState({ vatPercent: 0, exchangeEqualOrHigher: false, receiptNote: '' });

  useEffect(() => {
    if (!data?.data) return;
    const d = data.data;
    setForm({
      vatPercent: d.vatPercent ?? 0,
      exchangeEqualOrHigher: !!d.exchangeEqualOrHigher,
      receiptNote: d.receiptNote || ''
    });
  }, [data]);

  const { mutate: save, isLoading: saving } = useMutation(updatePosSettings, {
    onSuccess: () => {
      qc.invalidateQueries('pos-settings');
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1500, showConfirmButton: false });
    },
    onError: (e) => Swal.fire({ icon: 'error', title: e.response?.data?.message || 'Save failed' })
  });

  if (isLoading) {
    return <div className="h-40 bg-gray-100 animate-pulse rounded-md" />;
  }

  return (
    <div className="space-y-6">
      <Card
        title="VAT"
        subtitle="Global VAT rate applied to POS sales on the discounted goods value. A warehouse can override this rate (or its BIN) from Inventory → Warehouses."
      >
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={form.vatPercent}
            onChange={(e) =>
              setForm((p) => ({ ...p, vatPercent: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) }))
            }
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-gray-400"
          />
          <span className="text-sm text-gray-500">% VAT on POS sales</span>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Set to 0 to disable VAT. Receipts show the VAT line and the warehouse BIN when a rate/BIN is configured.
        </p>
      </Card>

      <Card title="Exchange Policy" subtitle="Controls what the POS accepts when a customer exchanges items.">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.exchangeEqualOrHigher}
            onChange={(e) => setForm((p) => ({ ...p, exchangeEqualOrHigher: e.target.checked }))}
            className="accent-[var(--brand)] w-4 h-4 mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-gray-700">Replacement must be equal or higher value</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              When enabled, an exchange is rejected if the new items total less than the return credit — the POS never
              hands cash back on an exchange. Customers can still use the plain Return flow for refunds.
            </span>
          </span>
        </label>
      </Card>

      <Card
        title="Receipt Footer Note"
        subtitle="Printed at the bottom of every POS receipt, just above the barcode. A warehouse can override it with its own note (Inventory → Warehouses)."
      >
        <textarea
          rows={3}
          maxLength={500}
          value={form.receiptNote}
          onChange={(e) => setForm((p) => ({ ...p, receiptNote: e.target.value }))}
          placeholder="e.g. Exchanges within 7 days with this receipt. No cash refunds."
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
        />
        <p className="text-xs text-gray-400 mt-1">{form.receiptNote.length}/500 · leave empty to print no note.</p>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => save({ ...form, vatPercent: Number(form.vatPercent) || 0 })}
          disabled={saving}
          className="px-5 py-2 rounded-md bg-[var(--brand)] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
