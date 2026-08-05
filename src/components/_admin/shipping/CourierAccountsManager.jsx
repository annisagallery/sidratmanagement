'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { confirmDelete } from 'src/utils/swal';
import { FiCopy, FiEye, FiEyeOff, FiPlus, FiStar, FiTrash2 } from 'react-icons/fi';
import { MdOutlineLocalShipping } from 'react-icons/md';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable from 'src/components/_admin/ui/DataTable';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';
const WEBHOOK_URLS = {
  steadfast: `${BASE_URL}/api/webhooks/courier/steadfast`,
  pathao: `${BASE_URL}/api/webhooks/courier/pathao`,
  carrybee: `${BASE_URL}/api/webhooks/courier/carrybee`
};

const PROVIDER_META = {
  pathao: { label: 'Pathao', cls: 'bg-red-50 text-red-600 border-red-200' },
  steadfast: { label: 'Steadfast', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  carrybee: { label: 'CarryBee', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
};

const CREDENTIAL_FIELDS = {
  pathao: [
    { key: 'clientId', label: 'Client ID', hint: 'From Pathao Merchant → API Credentials' },
    { key: 'clientSecret', label: 'Client Secret', secret: true },
    { key: 'username', label: 'Merchant email (username)', hint: 'Needed for the password grant token' },
    { key: 'password', label: 'Merchant password', secret: true },
    { key: 'storeId', label: 'Store ID', hint: 'The Pathao store parcels are sent from' }
  ],
  steadfast: [
    { key: 'apiKey', label: 'API Key', secret: true },
    { key: 'secretKey', label: 'Secret Key', secret: true },
    { key: 'merchantEmail', label: 'Merchant login email', hint: 'Used for the portal fraud check, which is not subject to API limits' },
    { key: 'merchantPassword', label: 'Merchant login password', secret: true }
  ],
  carrybee: [
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client Secret', secret: true },
    { key: 'clientContext', label: 'Client Context', secret: true },
    { key: 'accessToken', label: 'Fraud-check access token', secret: true, hint: 'Required by api-merchant.carrybee.com' },
    { key: 'merchantPhone', label: 'Merchant login phone', hint: 'Used server-side to obtain the fraud-check token automatically' },
    { key: 'merchantPassword', label: 'Merchant login password', secret: true },
    { key: 'storeId', label: 'Store ID', hint: 'Pickup store ID from CarryBee' },
    { key: 'businessId', label: 'Business ID', hint: 'Used for fraud checks (default: 9509)' }
  ]
};

const EMPTY_FORM = {
  provider: 'steadfast',
  name: '',
  credentials: {},
  webhookSecret: '',
  isActive: true,
  isDefault: false
};

function SecretInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        className="border border-gray-200 rounded-md px-3 py-2 pr-9 w-full text-sm font-mono focus:outline-none focus:border-[var(--brand)]"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
      </button>
    </div>
  );
}

function AccountForm({ initial, onSave, onCancel, saving }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(
    initial ? { ...EMPTY_FORM, ...initial, credentials: { ...(initial.credentials || {}) } } : EMPTY_FORM
  );
  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const setCred = (key, value) => setForm((p) => ({ ...p, credentials: { ...p.credentials, [key]: value } }));
  const fields = CREDENTIAL_FIELDS[form.provider] || [];

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return Swal.fire('Validation', 'Give the account a name.', 'warning');
    onSave(form);
  };

  return (
    <form onSubmit={submit} className="space-y-4 bg-gray-50 border border-gray-200 rounded-md p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
          <select
            value={form.provider}
            disabled={editing}
            onChange={(e) => set({ provider: e.target.value, credentials: {} })}
            className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm bg-white focus:outline-none focus:border-[var(--brand)] disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="steadfast">Steadfast</option>
            <option value="pathao">Pathao</option>
            <option value="carrybee">CarryBee</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Account name *</label>
          <input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Steadfast — Main"
            className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-[var(--brand)]"
          />
        </div>
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
            {field.secret ? (
              <SecretInput
                value={form.credentials[field.key] || ''}
                onChange={(e) => setCred(field.key, e.target.value)}
                placeholder={editing ? 'Leave blank to keep current' : ''}
              />
            ) : (
              <input
                value={form.credentials[field.key] || ''}
                onChange={(e) => setCred(field.key, e.target.value)}
                className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-[var(--brand)]"
              />
            )}
            {field.hint && <p className="text-[11px] text-gray-400 mt-1">{field.hint}</p>}
          </div>
        ))}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Webhook secret</label>
          <input
            value={form.webhookSecret}
            onChange={(e) => set({ webhookSecret: e.target.value })}
            placeholder="Any random string — set the same value in the courier dashboard"
            className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm font-mono focus:outline-none focus:border-[var(--brand)]"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Webhook URL for {PROVIDER_META[form.provider].label}:{' '}
            <span className="font-mono text-gray-500">{WEBHOOK_URLS[form.provider]}</span> — the courier calls it on
            every parcel status change so tracking updates automatically.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="accent-[var(--brand)]" />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} className="accent-[var(--brand)]" />
          Default for {PROVIDER_META[form.provider].label}
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function CourierAccountsManager() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [balances, setBalances] = useState({});

  const { data, isLoading } = useQuery(['courier-accounts'], api.getCourierAccounts, {
    select: (d) => d?.data ?? []
  });
  const accounts = data || [];
  const invalidate = () => qc.invalidateQueries(['courier-accounts']);

  const create = useMutation(api.createCourierAccount, {
    onSuccess: () => {
      invalidate();
      setShowForm(false);
    },
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });
  const update = useMutation(api.updateCourierAccount, {
    onSuccess: () => {
      invalidate();
      setEditingAccount(null);
    },
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });
  const setDefault = useMutation(api.setDefaultCourierAccount, {
    onSuccess: invalidate,
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });
  const remove = useMutation(api.deleteCourierAccount, {
    onSuccess: invalidate,
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const handleDelete = async (account) => {
    const confirmed = await confirmDelete({
      subject: account.name,
      text: 'Existing shipments keep their history; you just can’t book new ones with it.',
      confirmText: 'Remove'
    });
    if (confirmed) remove.mutate(account.id);
  };

  const checkBalance = async (account) => {
    setBalances((p) => ({ ...p, [account.id]: '…' }));
    try {
      const res = await api.getCourierAccountBalance(account.id);
      setBalances((p) => ({ ...p, [account.id]: `৳${res?.data?.balance ?? '?'}` }));
    } catch (e) {
      setBalances((p) => ({ ...p, [account.id]: 'error' }));
      Swal.fire('Balance check failed', e?.response?.data?.message || 'Check the credentials.', 'error');
    }
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    Swal.fire({ title: 'Copied', icon: 'success', timer: 900, showConfirmButton: false, toast: true, position: 'top-end' });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Courier Accounts"
        subtitle="Pathao & Steadfast accounts used to send shipments — mark one default per provider"
        icon={MdOutlineLocalShipping}
      >
        {!showForm && !editingAccount && (
          <button onClick={() => setShowForm(true)} className="btn-brand">
            <FiPlus size={15} /> Add Account
          </button>
        )}
      </PageHeader>

      {(showForm || editingAccount) && (
        <AccountForm
          initial={editingAccount}
          saving={create.isLoading || update.isLoading}
          onSave={(form) =>
            editingAccount ? update.mutate({ id: editingAccount.id, ...form }) : create.mutate(form)
          }
          onCancel={() => {
            setShowForm(false);
            setEditingAccount(null);
          }}
        />
      )}

      <div className="rounded-md border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">Webhook setup (one-time, per provider)</p>
        <p className="flex items-center gap-2">
          Steadfast: <span className="font-mono">{WEBHOOK_URLS.steadfast}</span>
          <button onClick={() => copy(WEBHOOK_URLS.steadfast)} className="text-blue-500 hover:text-blue-700"><FiCopy size={12} /></button>
          — set the webhook secret as the Bearer token.
        </p>
        <p className="flex items-center gap-2">
          Pathao: <span className="font-mono">{WEBHOOK_URLS.pathao}</span>
          <button onClick={() => copy(WEBHOOK_URLS.pathao)} className="text-blue-500 hover:text-blue-700"><FiCopy size={12} /></button>
          — set the webhook secret in the Pathao merchant dashboard.
        </p>
        <p className="flex items-center gap-2">
          CarryBee: <span className="font-mono">{WEBHOOK_URLS.carrybee}</span>
          <button onClick={() => copy(WEBHOOK_URLS.carrybee)} className="text-blue-500 hover:text-blue-700"><FiCopy size={12} /></button>
          — use the webhook integration secret configured above.
        </p>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-14 text-sm text-gray-500 border border-dashed border-gray-300 rounded-md">
          No courier accounts yet — add your Pathao or Steadfast credentials above to start sending shipments.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <DataTable className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Account</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Provider</th>
                <th className="px-4 py-2.5 text-center text-xs text-gray-500 uppercase tracking-wide">Default</th>
                <th className="px-4 py-2.5 text-center text-xs text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Balance</th>
                <th className="px-4 py-2.5 text-right text-xs text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const meta = PROVIDER_META[account.provider] || PROVIDER_META.steadfast;
                return (
                  <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-800">{account.name}</p>
                      {account.webhookSecret ? (
                        <p className="text-[11px] text-gray-400">webhook secret set</p>
                      ) : (
                        <p className="text-[11px] text-amber-500">no webhook secret — tracking won’t auto-update</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {account.isDefault ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <FiStar size={12} /> Default
                        </span>
                      ) : (
                        <button
                          onClick={() => setDefault.mutate(account.id)}
                          disabled={setDefault.isLoading}
                          className="text-xs text-gray-400 hover:text-[var(--brand-strong)] hover:underline"
                        >
                          Make default
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-medium ${account.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                      >
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {account.provider === 'steadfast' ? (
                        <button
                          onClick={() => checkBalance(account)}
                          className="text-xs text-[var(--brand-strong)] hover:underline"
                        >
                          {balances[account.id] || 'Check balance'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setShowForm(false);
                            setEditingAccount(account);
                          }}
                          className="px-2 py-1 text-xs text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] rounded-md transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(account)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition"
                          title="Remove account"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      )}
    </div>
  );
}
