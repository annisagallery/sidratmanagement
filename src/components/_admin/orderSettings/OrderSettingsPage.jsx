'use client';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getOrderSettings, updateOrderSettings } from 'src/services';
import { toastSuccess, toastError } from 'src/utils/swal';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Panel from 'src/components/_admin/ui/Panel';
import { ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';

const TYPES = [
  { key: 'regular', label: 'Regular' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'sameDay', label: 'Same day' }
];

const DAY_FIELD = { regular: 'regularDays', urgent: 'urgentDays', sameDay: 'sameDayDays' };

const dueFor = (days) =>
  new Date(Date.now() + Math.max(0, Number(days) || 0) * 86400000).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

export default function OrderSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery('order-settings', getOrderSettings);

  const [form, setForm] = useState({ regularDays: 7, urgentDays: 2, sameDayDays: 0, defaultDeliveryType: 'regular' });
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!data?.data) return;
    const d = data.data;
    const next = {
      regularDays: d.regularDays ?? 7,
      urgentDays: d.urgentDays ?? 2,
      sameDayDays: d.sameDayDays ?? 0,
      defaultDeliveryType: d.defaultDeliveryType || 'regular'
    };
    setForm(next);
    setSaved(next);
  }, [data]);

  const dirty = saved !== null && JSON.stringify(form) !== JSON.stringify(saved);

  const { mutate: save, isLoading: saving } = useMutation(updateOrderSettings, {
    onSuccess: () => {
      toastSuccess('Delivery types saved');
      setSaved(form);
      qc.invalidateQueries('order-settings');
    },
    onError: (e) => toastError(e, 'Could not save the delivery types.')
  });

  if (isLoading) return <LoadingBlock rows={3} />;
  // Never offer a form built from defaults when the real values failed to load.
  if (isError || !data?.data) return <ErrorState error={error} title="Delivery settings could not be loaded" onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <Panel
        title="Delivery types"
        description="Days are added to the order date to set its estimated delivery. The default is pre-selected on new orders."
        bodyClassName="!p-0 !pt-4"
      >
        <div className="border-t border-slate-200">
          <GlobalTable>
            <caption className="sr-only">Delivery types</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Days to deliver</th>
                <th scope="col" className="hidden sm:table-cell">
                  An order placed today is due
                </th>
                <th scope="col" className="text-center">
                  Default
                </th>
              </tr>
            </thead>
            <tbody>
              {TYPES.map((t) => {
                const field = DAY_FIELD[t.key];
                return (
                  <tr key={t.key}>
                    <td className="font-medium text-slate-900">{t.label}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={form[field]}
                          onChange={(e) => setForm((p) => ({ ...p, [field]: Number(e.target.value) }))}
                          aria-label={`Days to deliver — ${t.label}`}
                          className="input-ui w-24 tabular-nums"
                        />
                        <span className="text-[13px] text-slate-500">days</span>
                      </span>
                    </td>
                    <td className="hidden text-slate-600 sm:table-cell">{dueFor(form[field])}</td>
                    <td className="text-center">
                      <input
                        type="radio"
                        name="defaultDeliveryType"
                        checked={form.defaultDeliveryType === t.key}
                        onChange={() => setForm((p) => ({ ...p, defaultDeliveryType: t.key }))}
                        aria-label={`Make ${t.label} the default`}
                        className="h-4 w-4 accent-slate-900"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </GlobalTable>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          {dirty ? <span className="mr-auto text-[13px] text-slate-600">You have unsaved changes.</span> : null}
          {dirty ? (
            <button type="button" className="btn-quiet" onClick={() => setForm(saved)} disabled={saving}>
              Discard
            </button>
          ) : null}
          <button type="button" onClick={() => save(form)} disabled={saving || !dirty} className="btn-brand">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </Panel>
    </div>
  );
}
