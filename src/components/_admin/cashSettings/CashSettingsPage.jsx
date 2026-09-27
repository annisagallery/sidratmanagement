'use client';
import { useState, useEffect, useMemo } from 'react';
import { MdAdd, MdDeleteOutline } from 'react-icons/md';
import { toastSuccess, alertError } from 'src/utils/swal';
import { getCashSettings, updateCashSettings } from 'src/services';
import { Field, SettingsCard, Toggle } from 'src/components/_admin/ui/fields';
import Segmented from 'src/components/_admin/ui/Segmented';
import Callout from 'src/components/_admin/ui/Callout';
import { ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';

const BDT = '৳';

const DEFAULTS = {
  isActive: false,
  rewardPercent: 0,
  purchaseRewardType: 'percent',
  purchaseRanges: [],
  minOrderAmount: 0,
  maxCashBalance: 0,
  expiryDays: 0,
  allowCashAtCheckout: true,
  maxUsePercent: 100,
  signupBonus: 0,
  reviewReward: 0
};

function MoneyInput({ value, onChange, label, suffix = BDT, disabled = false, ...rest }) {
  return (
    <span className="relative block">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
        className="input-ui pr-10 tabular-nums"
        {...rest}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-500">{suffix}</span>
    </span>
  );
}

/** Which range (by index) breaks the rules, and why. */
function rangeProblem(ranges) {
  const sorted = ranges.map((range, index) => ({ ...range, index })).sort((a, b) => a.minAmount - b.minAmount);
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i];
    if (range.minAmount < 0 || range.maxAmount < 0 || range.rewardAmount < 0) return { index: range.index, message: 'Amounts cannot be negative.' };
    if (range.maxAmount > 0 && range.maxAmount < range.minAmount) return { index: range.index, message: 'The maximum is below the minimum.' };
    if (i > 0 && (sorted[i - 1].maxAmount === 0 || range.minAmount <= sorted[i - 1].maxAmount)) {
      return { index: range.index, message: 'This range overlaps the one before it.' };
    }
  }
  return null;
}

export default function CashSettingsPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [problem, setProblem] = useState(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    getCashSettings()
      .then((r) => {
        const next = { ...DEFAULTS, ...(r.data || {}) };
        setSettings(next);
        setSaved(next);
      })
      .catch((e) => setLoadError(e))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const dirty = useMemo(() => saved !== null && JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  const handleSave = async (event) => {
    event?.preventDefault();
    const ranges = [...settings.purchaseRanges].sort((a, b) => a.minAmount - b.minAmount);
    if (settings.purchaseRewardType === 'range') {
      const found = rangeProblem(settings.purchaseRanges);
      setProblem(found);
      if (found) return;
    }

    setSaving(true);
    try {
      await updateCashSettings({ ...settings, purchaseRanges: ranges });
      const next = { ...settings, purchaseRanges: ranges };
      setSettings(next);
      setSaved(next);
      toastSuccess('Cashback settings saved');
    } catch (e) {
      alertError(e, { title: 'The settings were not saved' });
    } finally {
      setSaving(false);
    }
  };

  const setNumber = (key) => (e) => setSettings((p) => ({ ...p, [key]: Number(e.target.value) }));
  const setRange = (index, key) => (e) => {
    setProblem(null);
    setSettings((current) => ({
      ...current,
      purchaseRanges: current.purchaseRanges.map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, [key]: Number(e.target.value) } : range
      )
    }));
  };
  const addRange = () =>
    setSettings((current) => ({
      ...current,
      purchaseRanges: [...current.purchaseRanges, { minAmount: 0, maxAmount: 0, rewardAmount: 0 }]
    }));
  const removeRange = (index) => {
    setProblem(null);
    setSettings((current) => ({
      ...current,
      purchaseRanges: current.purchaseRanges.filter((_, rangeIndex) => rangeIndex !== index)
    }));
  };

  if (loading) return <LoadingBlock rows={6} />;
  // Never offer defaults as if they were the saved rules — saving them would
  // overwrite the real ones.
  if (loadError) return <ErrorState error={loadError} title="Cashback settings could not be loaded" onRetry={load} />;

  const exampleEarning = Math.floor((settings.rewardPercent / 100) * 1000);
  const maxUsableLabel = settings.maxUsePercent > 0 ? `up to ${settings.maxUsePercent}% of the order total` : 'with no limit';

  const summary = [
    settings.purchaseRewardType === 'range'
      ? `Purchase cashback uses ${settings.purchaseRanges.length} range${settings.purchaseRanges.length === 1 ? '' : 's'}.`
      : settings.rewardPercent > 0
        ? `A ${BDT}1,000 order earns ${BDT}${exampleEarning} (${settings.rewardPercent}%).`
        : 'Set a cashback rate to start rewarding purchases.',
    settings.signupBonus > 0 ? `New customers get ${BDT}${settings.signupBonus} on sign-up.` : null,
    settings.reviewReward > 0 ? `Verified reviews earn ${BDT}${settings.reviewReward}.` : null,
    settings.allowCashAtCheckout ? `Spendable at checkout ${maxUsableLabel}.` : 'Not spendable at checkout.'
  ].filter(Boolean);

  return (
    <form onSubmit={handleSave} className="space-y-6" noValidate>
      <SettingsCard title="Cashback programme" description={summary.join(' ')}>
        <Toggle
          label="Cashback is on"
          help="When off, no cashback is earned or offered at checkout. Balances customers already hold are kept."
          checked={settings.isActive}
          onChange={(value) => setSettings((p) => ({ ...p, isActive: value }))}
        />
      </SettingsCard>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <SettingsCard title="Earning rules" description="How customers earn cashback.">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-slate-800">Purchase cashback</p>
            <Segmented
              label="Purchase cashback type"
              options={[
                { id: 'percent', label: 'Percentage of order' },
                { id: 'range', label: 'Fixed amount by range' }
              ]}
              value={settings.purchaseRewardType}
              onChange={(value) => {
                setProblem(null);
                setSettings((current) => ({ ...current, purchaseRewardType: value }));
              }}
            />
          </div>

          {settings.purchaseRewardType === 'percent' ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Cashback rate"
                help={settings.rewardPercent > 0 ? `${BDT}${exampleEarning} on every ${BDT}1,000, credited on delivery.` : 'Share of the order total, credited on delivery.'}
              >
                <MoneyInput value={settings.rewardPercent} onChange={setNumber('rewardPercent')} suffix="%" max={100} step={0.5} />
              </Field>
              <Field label="Minimum order to earn" help="Orders below this earn nothing. 0 means no minimum.">
                <MoneyInput value={settings.minOrderAmount} onChange={setNumber('minOrderAmount')} />
              </Field>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-slate-600">A fixed cashback amount for each order-total range. A maximum of 0 means no upper limit.</p>
                <button type="button" onClick={addRange} className="btn-ghost btn-sm shrink-0">
                  <MdAdd size={16} aria-hidden /> Add range
                </button>
              </div>
              {settings.purchaseRanges.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-[13px] text-slate-500">
                  No ranges yet. Add one to reward purchases.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-[13px]">
                    <caption className="sr-only">Purchase cashback ranges</caption>
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left">From ({BDT})</th>
                        <th scope="col" className="px-3 py-2 text-left">To ({BDT})</th>
                        <th scope="col" className="px-3 py-2 text-left">Cashback ({BDT})</th>
                        <th scope="col" className="w-12 px-2 py-2">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {settings.purchaseRanges.map((range, index) => (
                        <tr key={index} className={problem?.index === index ? 'bg-rose-50' : ''}>
                          {['minAmount', 'maxAmount', 'rewardAmount'].map((key) => (
                            <td key={key} className="px-3 py-2">
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                value={range[key]}
                                onChange={setRange(index, key)}
                                aria-label={`Range ${index + 1} — ${key === 'minAmount' ? 'from' : key === 'maxAmount' ? 'to' : 'cashback'}`}
                                aria-invalid={problem?.index === index}
                                className="input-ui h-8 tabular-nums"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRange(index)}
                              aria-label={`Remove range ${index + 1}`}
                              title="Remove range"
                              className="btn-icon btn-icon-sm btn-icon-danger"
                            >
                              <MdDeleteOutline size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {problem ? (
                <p className="text-[13px] font-medium text-rose-700" role="alert">
                  Range {problem.index + 1}: {problem.message}
                </p>
              ) : null}
            </div>
          )}

          <div className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <Field label="Sign-up bonus" help="One-time bonus for new accounts. 0 turns it off.">
              <MoneyInput value={settings.signupBonus} onChange={setNumber('signupBonus')} />
            </Field>
            <Field label="Review reward" help="For each verified review of a completed order item. 0 turns it off.">
              <MoneyInput value={settings.reviewReward} onChange={setNumber('reviewReward')} />
            </Field>
            <Field label="Maximum balance per customer" help="The most one customer can hold. 0 means no limit.">
              <MoneyInput value={settings.maxCashBalance} onChange={setNumber('maxCashBalance')} />
            </Field>
            <Field label="Expires after" help="Days before earned cashback expires. 0 means it never expires.">
              <MoneyInput value={settings.expiryDays} onChange={setNumber('expiryDays')} suffix="days" />
            </Field>
          </div>
        </SettingsCard>

        <div className="space-y-6">
          <SettingsCard title="Redemption rules" description="How customers spend cashback at checkout.">
            <Toggle
              label="Allow cashback at checkout"
              help="Customers can use their balance to pay."
              checked={settings.allowCashAtCheckout}
              onChange={(value) => setSettings((p) => ({ ...p, allowCashAtCheckout: value }))}
            />
            <Field
              label="Most of an order payable with cashback"
              help={settings.allowCashAtCheckout ? '100 lets cashback pay the whole order. 0 means no limit.' : 'Turn on cashback at checkout first.'}
            >
              <MoneyInput
                value={settings.maxUsePercent}
                onChange={setNumber('maxUsePercent')}
                suffix="%"
                max={100}
                disabled={!settings.allowCashAtCheckout}
              />
            </Field>
          </SettingsCard>

          <Callout title="Quick reference">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>1 cashback = {BDT}1 — taka for taka, no conversion.</li>
              <li>Purchase cashback is credited when the order is delivered.</li>
              <li>Review cashback is credited once per completed order item.</li>
              <li>Adjust a customer’s balance from User balances or their customer page.</li>
              <li>Every movement is logged under Transactions.</li>
            </ul>
          </Callout>
        </div>
      </div>

      {dirty ? (
        <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-xl flex-wrap items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">
          <span className="mr-auto font-medium" role="status">
            You have unsaved changes
          </span>
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-slate-200 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setSettings(saved);
              setProblem(null);
            }}
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
      ) : null}
    </form>
  );
}
