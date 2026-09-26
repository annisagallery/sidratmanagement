'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { FiShield, FiAlertTriangle, FiTrash2 } from 'react-icons/fi';
import { fDateTime } from 'src/utils/formatTime';

// Balance verification — UddoktaPay's defence against forged payment SMS.
//
// A sender ID can be spoofed, so a message that merely says "you received Tk
// 500" proves nothing. Every genuine wallet SMS also states the balance after
// the transaction, and that has to equal the last verified balance plus the
// amount. Somebody sets the real balance here once, reading it off the wallet
// app; from then on only messages that chain exactly can verify a payment on
// their own. The rest wait for a person in Payment Verification.

// Wallets whose SMS state the balance after each transaction. Cellfin's do
// not, so it cannot be verified this way.
const PROVIDERS = [
  ['bkash', 'bKash'],
  ['nagad', 'Nagad'],
  ['rocket', 'Rocket'],
  ['upay', 'Upay'],
  ['tap', 'Tap'],
  ['okwallet', 'OK Wallet'],
  ['mcash', 'mCash'],
  ['pathaopay', 'Pathao Pay']
];
const providerName = (slug) => PROVIDERS.find(([s]) => s === slug)?.[1] || slug;
const simLabel = (slot) => (slot ? `SIM ${slot}` : 'Any SIM');
const money = (n) =>
  `৳${Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function WalletModal({ devices, initial, onClose }) {
  const qc = useQueryClient();
  const editing = Boolean(initial?.id);
  const [deviceId, setDeviceId] = useState(initial?.deviceRowId || devices[0]?.id || '');
  const [provider, setProvider] = useState(initial?.provider || 'bkash');
  const [simSlot, setSimSlot] = useState(String(initial?.simSlot ?? 0));
  const [balance, setBalance] = useState('');

  const { mutate, isLoading } = useMutation(
    () =>
      api.setWalletBalance({
        deviceId,
        provider,
        simSlot: Number(simSlot),
        currentBalance: Number(balance)
      }),
    {
      onSuccess: (res) => {
        qc.invalidateQueries(['sms-devices']);
        onClose();
        if (res?.verified) {
          Swal.fire('Balance set', `${res.verified} waiting message(s) now chain and were verified.`, 'success');
        }
      },
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
    }
  );

  const valid = deviceId && balance !== '' && Number(balance) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-md bg-white p-6 shadow-xl">
        <h3 className="font-semibold text-slate-800">
          {editing ? `Update ${providerName(provider)} balance` : 'Verify a wallet balance'}
        </h3>
        <p className="text-xs text-slate-500">
          Open the wallet app on the collector phone and enter the balance it shows right now. Do it
          when no payment is in flight.
        </p>

        {!editing && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Collector phone</label>
              <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="input-ui">
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Wallet</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className="input-ui">
                  {PROVIDERS.map(([slug, name]) => (
                    <option key={slug} value={slug}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">SIM slot</label>
                <select value={simSlot} onChange={(e) => setSimSlot(e.target.value)} className="input-ui">
                  <option value="0">Any SIM</option>
                  <option value="1">SIM 1</option>
                  <option value="2">SIM 2</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Pin the SIM the wallet number is on: a forged SMS sent to the phone&apos;s other number is
              then held even if it guesses the balance. Needs collector app 2.1 or later.
            </p>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Current balance (৳)</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="e.g. 12450.50"
            className="input-ui"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={() => mutate()} disabled={!valid || isLoading} className="btn-brand">
            {isLoading ? 'Saving…' : 'Save balance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BalanceVerification({ devices }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // {} for new, a wallet to update

  const activeDevices = devices.filter((d) => d.isActive);
  const wallets = devices.flatMap((device) =>
    (device.wallets || []).map((wallet) => ({ ...wallet, deviceName: device.name }))
  );

  const onError = (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error');
  const { mutate: toggle } = useMutation(api.updateWalletBalance, {
    onSuccess: () => qc.invalidateQueries(['sms-devices']),
    onError
  });
  const { mutate: remove } = useMutation(api.deleteWalletBalance, {
    onSuccess: () => qc.invalidateQueries(['sms-devices']),
    onError
  });

  const confirmRemove = (wallet) =>
    Swal.fire({
      title: `Stop verifying ${providerName(wallet.provider)} on "${wallet.deviceName}"?`,
      text: 'Its payment SMS will be matched without the balance check, as before it was set up.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Stop verifying',
      confirmButtonColor: '#e11d48'
    }).then((r) => r.isConfirmed && remove(wallet.id));

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <FiShield className="text-slate-500" size={16} />
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Balance verification</h2>
            <p className="text-xs text-slate-500">
              Payment SMS must chain from the wallet&apos;s real balance, so a forged message cannot
              verify a payment.
            </p>
          </div>
        </div>
        <button onClick={() => setModal({})} disabled={!activeDevices.length} className="btn-brand">
          + Verify a wallet
        </button>
      </div>

      {wallets.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          No wallet is being verified. Until one is, payment SMS are matched on transaction ID,
          amount and timing alone.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Wallet</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 text-right font-medium">Verified balance</th>
                <th className="px-4 py-2 font-medium">Last moved</th>
                <th className="px-4 py-2 text-right font-medium">Held</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet) => (
                <tr key={wallet.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{providerName(wallet.provider)}</p>
                    <p className="text-xs text-slate-400">{simLabel(wallet.simSlot)}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{wallet.deviceName}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-800">
                    {money(wallet.currentBalance)}
                    {!wallet.isActive && <p className="text-xs font-sans text-slate-400">Paused</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {fDateTime(wallet.lastVerifiedAt || wallet.anchoredAt)}
                    {!wallet.lastVerifiedAt && <span className="text-slate-400"> (set by hand)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {wallet.held > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"
                        title="Messages that did not chain. If the balance was changed outside these SMS, set it again."
                      >
                        <FiAlertTriangle size={11} /> {wallet.held}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setModal(wallet)}
                        className="whitespace-nowrap rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Set balance
                      </button>
                      <button
                        onClick={() => toggle({ id: wallet.id, isActive: !wallet.isActive })}
                        className="whitespace-nowrap rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {wallet.isActive ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => confirmRemove(wallet)}
                        aria-label={`Stop verifying ${providerName(wallet.provider)}`}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <WalletModal devices={activeDevices} initial={modal} onClose={() => setModal(null)} />}
    </section>
  );
}
