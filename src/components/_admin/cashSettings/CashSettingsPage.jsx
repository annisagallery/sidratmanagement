'use client';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { getCashSettings, updateCashSettings } from 'src/services';
import { MdToggleOn, MdToggleOff, MdInfoOutline, MdAdd, MdDeleteOutline } from 'react-icons/md';

const BDT = '৳';
const inp =
  'border rounded-md px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition';

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

export default function CashSettingsPage() {
  const [settings, setSettings] = useState({
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
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCashSettings()
      .then((r) => setSettings((p) => ({ ...p, ...(r.data || {}) })))
      .catch((e) => Swal.fire('Error', e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const ranges = [...settings.purchaseRanges].sort((a, b) => a.minAmount - b.minAmount);
    if (settings.purchaseRewardType === 'range') {
      const invalidIndex = ranges.findIndex(
        (range, index) =>
          range.minAmount < 0 ||
          range.maxAmount < 0 ||
          range.rewardAmount < 0 ||
          (range.maxAmount > 0 && range.maxAmount < range.minAmount) ||
          (index > 0 && (ranges[index - 1].maxAmount === 0 || range.minAmount <= ranges[index - 1].maxAmount))
      );
      if (invalidIndex >= 0) {
        Swal.fire('Invalid purchase ranges', 'Ranges must contain valid amounts and cannot overlap.', 'warning');
        return;
      }
    }

    setSaving(true);
    try {
      await updateCashSettings({ ...settings, purchaseRanges: ranges });
      setSettings((current) => ({ ...current, purchaseRanges: ranges }));
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Settings saved!',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setSettings((p) => ({ ...p, [key]: Number(e.target.value) }));
  const toggle = (key) => () => setSettings((p) => ({ ...p, [key]: !p[key] }));
  const setRange = (index, key) => (e) =>
    setSettings((current) => ({
      ...current,
      purchaseRanges: current.purchaseRanges.map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, [key]: Number(e.target.value) } : range
      )
    }));
  const addRange = () =>
    setSettings((current) => ({
      ...current,
      purchaseRanges: [...current.purchaseRanges, { minAmount: 0, maxAmount: 0, rewardAmount: 0 }]
    }));
  const removeRange = (index) =>
    setSettings((current) => ({
      ...current,
      purchaseRanges: current.purchaseRanges.filter((_, rangeIndex) => rangeIndex !== index)
    }));

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-72 bg-gray-100 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  const exampleEarning = Math.floor((settings.rewardPercent / 100) * 1000);
  const maxUsableLabel = settings.maxUsePercent > 0 ? `up to ${settings.maxUsePercent}% of order total` : 'unlimited';

  return (
    <div className="space-y-6">
      {/* Active toggle */}
      <div className="flex items-center justify-between bg-white border rounded-md px-5 py-4">
        <div className="flex items-start gap-2">
          <MdInfoOutline size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            <span className="font-semibold">Cashback is {settings.isActive ? 'active' : 'inactive'}. </span>
            {settings.purchaseRewardType === 'range' ? (
              <>
                Purchase cashback uses <strong>{settings.purchaseRanges.length} configured range{settings.purchaseRanges.length === 1 ? '' : 's'}</strong>.{' '}
              </>
            ) : settings.rewardPercent > 0 ? (
              <>
                A <strong>{BDT}1,000</strong> order earns{' '}
                <strong>
                  {BDT}
                  {exampleEarning}
                </strong>{' '}
                cashback ({settings.rewardPercent}%).{' '}
              </>
            ) : (
              <>Set a reward % to start giving cashback. </>
            )}
            {settings.signupBonus > 0 && (
              <>
                New users receive{' '}
                <strong>
                  {BDT}
                  {settings.signupBonus}
                </strong>{' '}
                on signup.{' '}
              </>
            )}
            {settings.reviewReward > 0 && (
              <>
                Verified reviews earn{' '}
                <strong>
                  {BDT}
                  {settings.reviewReward}
                </strong>
                .{' '}
              </>
            )}
            {settings.allowCashAtCheckout && <>Redeemable at checkout ({maxUsableLabel}).</>}
          </p>
        </div>
        <button
          onClick={toggle('isActive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm border flex-shrink-0 ml-4 transition ${
            settings.isActive
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
          {settings.isActive ? (
            <MdToggleOn size={22} className="text-green-600" />
          ) : (
            <MdToggleOff size={22} className="text-gray-400" />
          )}
          {settings.isActive ? 'Active' : 'Inactive'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Earning Rules */}
        <div className="bg-white border rounded-md p-6 space-y-5">
          <div>
            <h2 className="font-bold text-gray-800">Earning Rules</h2>
            <p className="text-xs text-gray-400 mt-0.5">How customers earn cashback</p>
          </div>

          <div>
            <p className="block text-sm font-semibold text-gray-700 mb-2">Purchase Cashback Type</p>
            <div className="grid grid-cols-2 border border-gray-200 rounded-md p-1 bg-gray-50">
              {[
                ['percent', 'Percentage'],
                ['range', 'Purchase Range']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSettings((current) => ({ ...current, purchaseRewardType: value }))}
                  className={`px-3 py-2 rounded-md text-sm font-semibold transition ${
                    settings.purchaseRewardType === value ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {settings.purchaseRewardType === 'percent' ? (
          <>
          <Field label="Cashback Rate (%)" hint="% of order total awarded as cashback on delivery">
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settings.rewardPercent}
                onChange={set('rewardPercent')}
                className={inp}
              />
              {settings.rewardPercent > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-semibold pointer-events-none">
                  {BDT}
                  {exampleEarning} per {BDT}1,000
                </span>
              )}
            </div>
          </Field>

          <Field label={`Minimum Order to Earn (${BDT})`} hint="Orders below this earn no cashback (0 = no minimum)">
            <input
              type="number"
              min={0}
              value={settings.minOrderAmount}
              onChange={set('minOrderAmount')}
              className={inp}
            />
          </Field>
          </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Purchase Ranges</p>
                  <p className="text-xs text-gray-400">Set a fixed cashback amount for each order-total range</p>
                </div>
                <button type="button" onClick={addRange} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50">
                  <MdAdd size={17} /> Add range
                </button>
              </div>
              {settings.purchaseRanges.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-md p-5 text-center text-sm text-gray-400">
                  No purchase ranges configured
                </div>
              ) : (
                settings.purchaseRanges.map((range, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_36px] gap-2 items-end p-3 border border-gray-100 rounded-md bg-gray-50">
                    <Field label={`Minimum (${BDT})`}><input type="number" min={0} value={range.minAmount} onChange={setRange(index, 'minAmount')} className={inp} /></Field>
                    <Field label={`Maximum (${BDT})`} hint="0 = unlimited"><input type="number" min={0} value={range.maxAmount} onChange={setRange(index, 'maxAmount')} className={inp} /></Field>
                    <Field label={`Cashback (${BDT})`}><input type="number" min={0} value={range.rewardAmount} onChange={setRange(index, 'rewardAmount')} className={inp} /></Field>
                    <button type="button" onClick={() => removeRange(index)} title="Remove range" className="h-[42px] w-9 flex items-center justify-center rounded-md text-red-500 hover:bg-red-50 justify-self-end sm:justify-self-auto">
                      <MdDeleteOutline size={19} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <Field label={`Signup Cashback (${BDT})`} hint="One-time bonus for new registrations (0 = disabled)">
            <input type="number" min={0} value={settings.signupBonus} onChange={set('signupBonus')} className={inp} />
          </Field>

          <Field
            label={`Review Cashback (${BDT})`}
            hint="Fixed reward for each verified completed-order item review (0 = disabled)"
          >
            <input
              type="number"
              min={0}
              value={settings.reviewReward}
              onChange={set('reviewReward')}
              className={inp}
            />
          </Field>

          <Field label={`Max Cashback Balance per User (${BDT})`} hint="Maximum a user can hold (0 = unlimited)">
            <input
              type="number"
              min={0}
              value={settings.maxCashBalance}
              onChange={set('maxCashBalance')}
              className={inp}
            />
          </Field>

          <Field label="Cashback Expiry (days)" hint="Days before cashback expires (0 = never expires)">
            <input type="number" min={0} value={settings.expiryDays} onChange={set('expiryDays')} className={inp} />
          </Field>
        </div>

        {/* Redemption Rules */}
        <div className="bg-white border rounded-md p-6 space-y-5">
          <div>
            <h2 className="font-bold text-gray-800">Redemption Rules</h2>
            <p className="text-xs text-gray-400 mt-0.5">How customers spend cashback at checkout</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
            <div>
              <p className="text-sm font-semibold text-gray-700">Allow Cashback at Checkout</p>
              <p className="text-xs text-gray-400 mt-0.5">Let customers use cashback balance to pay</p>
            </div>
            <button
              onClick={toggle('allowCashAtCheckout')}
              className={`relative w-12 h-6 rounded-md transition-colors flex-shrink-0 ${settings.allowCashAtCheckout ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-md shadow transition-transform ${settings.allowCashAtCheckout ? 'translate-x-6' : ''}`}
              />
            </button>
          </div>

          <Field label="Max Cashback Usable per Order (%)" hint="0 = unlimited, 100 = can pay the full order">
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                value={settings.maxUsePercent}
                onChange={set('maxUsePercent')}
                className={inp}
                disabled={!settings.allowCashAtCheckout}
              />
              {!settings.allowCashAtCheckout && (
                <div className="absolute inset-0 bg-white/70 rounded-md cursor-not-allowed" />
              )}
            </div>
          </Field>

          <div className="bg-gray-50 rounded-md p-4 text-xs text-gray-500 space-y-1.5">
            <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-2">Quick Reference</p>
            <p>
              • <strong>1 cashback = {BDT}1</strong> — direct taka, no conversion
            </p>
            <p>
              • Cashback credited when order → <strong>Delivered</strong>
            </p>
            <p>• Review cashback is credited once per completed order item</p>
            <p>• Admin can manually adjust from User Balances tab or any user's page</p>
            <p>• All transactions are logged in the Transactions tab</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold text-sm disabled:opacity-50 transition shadow-sm"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
