'use client';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getPosSettings, updatePosSettings } from 'src/services';
import { toastSuccess, toastError } from 'src/utils/swal';
import { Field, LengthCounter, SettingsCard, Toggle } from 'src/components/_admin/ui/fields';
import { ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';

export default function PosSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery('pos-settings', getPosSettings);

  const [form, setForm] = useState({ vatPercent: 0, exchangeEqualOrHigher: false, receiptNote: '' });
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!data?.data) return;
    const d = data.data;
    const next = {
      vatPercent: d.vatPercent ?? 0,
      exchangeEqualOrHigher: !!d.exchangeEqualOrHigher,
      receiptNote: d.receiptNote || ''
    };
    setForm(next);
    setSaved(next);
  }, [data]);

  const dirty = saved !== null && JSON.stringify(form) !== JSON.stringify(saved);

  const { mutate: save, isLoading: saving } = useMutation(updatePosSettings, {
    onSuccess: () => {
      toastSuccess('Branch terminal settings saved');
      setSaved(form);
      qc.invalidateQueries('pos-settings');
    },
    onError: (e) => toastError(e, 'Could not save the settings.')
  });

  const submit = (event) => {
    event.preventDefault();
    save({ ...form, vatPercent: Number(form.vatPercent) || 0 });
  };

  if (isLoading) return <LoadingBlock rows={5} />;
  if (isError || !data?.data) {
    return <ErrorState error={error} title="Branch terminal settings could not be loaded" onRetry={refetch} />;
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>
      <SettingsCard
        title="VAT"
        description="Applied to POS sales on the discounted goods value. A warehouse can override the rate or its BIN in Inventory → Warehouses."
      >
        <Field label="VAT rate" help="Set to 0 to turn VAT off. Receipts show the VAT line and warehouse BIN when configured.">
          <span className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.1"
              value={form.vatPercent}
              onChange={(e) =>
                setForm((p) => ({ ...p, vatPercent: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) }))
              }
              aria-label="VAT rate in percent"
              className="input-ui w-28 tabular-nums"
            />
            <span className="text-sm text-slate-600">% on POS sales</span>
          </span>
        </Field>
      </SettingsCard>

      <SettingsCard title="Exchange policy" description="What the POS accepts when a customer exchanges items.">
        <Toggle
          label="Replacement must be of equal or higher value"
          help="An exchange is refused if the new items total less than the return credit, so the POS never hands back cash on an exchange. Customers can still use the Return flow for refunds."
          checked={form.exchangeEqualOrHigher}
          onChange={(value) => setForm((p) => ({ ...p, exchangeEqualOrHigher: value }))}
        />
      </SettingsCard>

      <SettingsCard
        title="Receipt footer note"
        description="Printed at the bottom of every POS receipt, just above the barcode. A warehouse can set its own note in Inventory → Warehouses."
      >
        <Field
          label="Note"
          optional
          counter={<LengthCounter value={form.receiptNote} max={500} />}
          help="Leave empty to print no note."
        >
          <textarea
            rows={3}
            maxLength={500}
            value={form.receiptNote}
            onChange={(e) => setForm((p) => ({ ...p, receiptNote: e.target.value }))}
            placeholder="e.g. Exchanges within 7 days with this receipt. No cash refunds."
            className="input-ui"
          />
        </Field>
      </SettingsCard>

      <div className={`${dirty ? 'sticky bottom-4 z-30' : ''} flex items-center justify-end gap-3`}>
        {dirty ? (
          <div className="flex w-full max-w-xl items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl sm:ml-auto">
            <span className="mr-auto font-medium" role="status">
              You have unsaved changes
            </span>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => setForm(saved)}
              disabled={saving}
            >
              Discard
            </button>
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-md bg-white px-3 text-[13px] font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : (
          <button type="submit" disabled className="btn-brand">
            Save changes
          </button>
        )}
      </div>
    </form>
  );
}
