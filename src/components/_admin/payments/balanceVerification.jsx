'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import * as api from 'src/services';
import { FiShield, FiAlertTriangle, FiTrash2, FiPause, FiPlay } from 'react-icons/fi';
import { MdAdd } from 'react-icons/md';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { fDateTime } from 'src/utils/formatTime';
import { Field, ModalShell, fieldClass, selectClass } from 'src/components/_admin/ui/primitives';
import { toastSuccess, alertError, confirmAction } from 'src/utils/swal';

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
        toastSuccess(
          'Balance set',
          res?.verified ? `${res.verified} waiting message${res.verified === 1 ? '' : 's'} now chain and were verified.` : undefined
        );
      },
      onError: (e) => alertError(e, { title: 'The balance was not saved' })
    }
  );

  const valid = deviceId && balance !== '' && Number(balance) >= 0;

  return (
    <ModalShell
      title={editing ? `Update the ${providerName(provider)} balance` : 'Verify a wallet balance'}
      subtitle="Balance verification"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={isLoading}>
            Cancel
          </button>
          <button type="button" onClick={() => mutate()} disabled={!valid || isLoading} className="btn-brand">
            {isLoading ? 'Saving…' : 'Save balance'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-slate-600">
          Open the wallet app on the collector phone and enter the balance it shows right now. Do it when no payment is in
          flight.
        </p>

        {!editing && (
          <>
            <Field label="Collector phone">
              <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={selectClass}>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Wallet">
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className={selectClass}>
                  {PROVIDERS.map(([slug, name]) => (
                    <option key={slug} value={slug}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="SIM slot">
                <select value={simSlot} onChange={(e) => setSimSlot(e.target.value)} className={selectClass}>
                  <option value="0">Any SIM</option>
                  <option value="1">SIM 1</option>
                  <option value="2">SIM 2</option>
                </select>
              </Field>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-500">
              Pin the SIM the wallet number is on: a forged SMS sent to the phone&apos;s other number is then held even if it
              guesses the balance. Needs collector app 2.1 or later.
            </p>
          </>
        )}

        <Field label="Current balance (৳)" required>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="e.g. 12450.50"
            className={`${fieldClass} tabular-nums`}
            autoFocus
          />
        </Field>
      </div>
    </ModalShell>
  );
}

export default function BalanceVerification({ devices }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // {} for new, a wallet to update

  const activeDevices = devices.filter((d) => d.isActive);
  const wallets = devices.flatMap((device) =>
    (device.wallets || []).map((wallet) => ({ ...wallet, deviceName: device.name }))
  );

  const { mutate: toggle } = useMutation(api.updateWalletBalance, {
    onSuccess: (_res, vars) => {
      toastSuccess(vars.isActive ? 'Verification resumed' : 'Verification paused');
      qc.invalidateQueries(['sms-devices']);
    },
    onError: (e) => alertError(e, { title: 'The wallet was not updated' })
  });
  const { mutate: remove } = useMutation(api.deleteWalletBalance, {
    onSuccess: () => {
      toastSuccess('Verification stopped');
      qc.invalidateQueries(['sms-devices']);
    },
    onError: (e) => alertError(e, { title: 'Verification was not stopped' })
  });

  const confirmRemove = (wallet) =>
    confirmAction({
      tone: 'danger',
      title: `Stop verifying ${providerName(wallet.provider)} on “${wallet.deviceName}”?`,
      text: 'Its payment SMS will be matched without the balance check, as before it was set up.',
      confirmText: 'Stop verifying'
    }).then((confirmed) => confirmed && remove(wallet.id));

  return (
    <section className="card-ui overflow-hidden" aria-labelledby="balance-verification-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <FiShield className="mt-0.5 shrink-0 text-slate-400" size={17} aria-hidden />
          <div className="min-w-0">
            <h2 id="balance-verification-title" className="text-[15px] font-semibold text-slate-900">
              Balance verification
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Payment SMS must chain from the wallet&apos;s real balance, so a forged message cannot
              verify a payment.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModal({})}
          disabled={!activeDevices.length}
          title={activeDevices.length ? undefined : 'Pair an active collector device first'}
          className="btn-ghost"
        >
          <MdAdd size={18} aria-hidden /> Verify a wallet
        </button>
      </div>

      {wallets.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-slate-500">
          No wallet is being verified. Until one is, payment SMS are matched on transaction ID,
          amount and timing alone.
        </p>
      ) : (
        <GlobalTable>
          <caption className="sr-only">Wallets being verified</caption>
          <thead>
            <tr>
              <th scope="col">Wallet</th>
              <th scope="col" className="hidden sm:table-cell">Phone</th>
              <th scope="col" className="text-right">Verified balance</th>
              <th scope="col" className="hidden md:table-cell">Last moved</th>
              <th scope="col" className="text-right">Held</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet) => (
              <tr key={wallet.id}>
                <td>
                  <p className="text-[13px] font-medium text-slate-900">{providerName(wallet.provider)}</p>
                  <p className="text-xs text-slate-500">{simLabel(wallet.simSlot)}</p>
                </td>
                <td className="hidden text-[13px] text-slate-600 sm:table-cell">{wallet.deviceName}</td>
                <td className="text-right">
                  <span className="font-semibold tabular-nums text-slate-900">{money(wallet.currentBalance)}</span>
                  {!wallet.isActive && <p className="text-xs text-slate-500">Paused</p>}
                </td>
                <td className="hidden text-[13px] text-slate-600 md:table-cell">
                  {fDateTime(wallet.lastVerifiedAt || wallet.anchoredAt)}
                  {!wallet.lastVerifiedAt && <span className="text-slate-500"> (set by hand)</span>}
                </td>
                <td className="text-right">
                  {wallet.held > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-amber-800"
                      title="Messages that did not chain. If the balance was changed outside these SMS, set it again."
                    >
                      <FiAlertTriangle size={13} aria-hidden /> {wallet.held}
                      <span className="sr-only">messages held</span>
                    </span>
                  ) : (
                    <span className="text-[13px] tabular-nums text-slate-500">0</span>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => setModal(wallet)} className="btn-ghost btn-sm">
                      Set balance
                    </button>
                    <ActionMenu
                      label={`More actions for ${providerName(wallet.provider)} on ${wallet.deviceName}`}
                      items={[
                        {
                          label: wallet.isActive ? 'Pause verification' : 'Resume verification',
                          icon: wallet.isActive ? FiPause : FiPlay,
                          onClick: () => toggle({ id: wallet.id, isActive: !wallet.isActive })
                        },
                        { label: 'Stop verifying…', icon: FiTrash2, tone: 'danger', onClick: () => confirmRemove(wallet) }
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </GlobalTable>
      )}

      {modal && <WalletModal devices={activeDevices} initial={modal} onClose={() => setModal(null)} />}
    </section>
  );
}
