'use client';
import DataTable from 'src/components/_admin/ui/DataTable';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getOrderSettings, updateOrderSettings } from 'src/services';
import Swal from 'sweetalert2';

const TYPES = [
  { key: 'regular', label: 'Regular' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'sameDay', label: 'Same Day' }
];

const DAY_FIELD = { regular: 'regularDays', urgent: 'urgentDays', sameDay: 'sameDayDays' };

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

export default function OrderSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery('order-settings', getOrderSettings);

  const [form, setForm] = useState({ regularDays: 7, urgentDays: 2, sameDayDays: 0, defaultDeliveryType: 'regular' });

  useEffect(() => {
    if (!data?.data) return;
    const d = data.data;
    setForm({
      regularDays: d.regularDays ?? 7,
      urgentDays: d.urgentDays ?? 2,
      sameDayDays: d.sameDayDays ?? 0,
      defaultDeliveryType: d.defaultDeliveryType || 'regular'
    });
  }, [data]);

  const { mutate: save, isLoading: saving } = useMutation(updateOrderSettings, {
    onSuccess: () => {
      qc.invalidateQueries('order-settings');
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
        title="Delivery Types"
        subtitle="Days are added to today to calculate the estimated delivery date on customer orders."
      >
        <DataTable className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="pb-2 font-semibold">Type</th>
              <th className="pb-2 font-semibold w-32">Days</th>
              <th className="pb-2 font-semibold text-center">Default</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map((t) => (
              <tr key={t.key} className="border-b border-gray-50 last:border-0">
                <td className="py-3 font-medium text-gray-700">{t.label}</td>
                <td className="py-3 pr-6">
                  <input
                    type="number"
                    min={0}
                    value={form[DAY_FIELD[t.key]]}
                    onChange={(e) => setForm((p) => ({ ...p, [DAY_FIELD[t.key]]: Number(e.target.value) }))}
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-24 focus:outline-none focus:border-gray-400"
                  />
                  <span className="ml-2 text-xs text-gray-400">days</span>
                </td>
                <td className="py-3 text-center">
                  <input
                    type="radio"
                    name="defaultDeliveryType"
                    checked={form.defaultDeliveryType === t.key}
                    onChange={() => setForm((p) => ({ ...p, defaultDeliveryType: t.key }))}
                    className="accent-[var(--brand)] w-4 h-4"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => save(form)}
          disabled={saving}
          className="px-5 py-2 rounded-md bg-[var(--brand)] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
