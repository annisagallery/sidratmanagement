'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { MdAdd, MdDelete, MdEdit, MdOutlineLocalShipping, MdStar, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import * as api from 'src/services';
import { confirmDelete, toastSuccess, alertError } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Drawer from 'src/components/_admin/ui/Drawer';
import Panel from 'src/components/_admin/ui/Panel';
import Badge, { RecordStatus } from 'src/components/_admin/ui/Badge';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { Field, Toggle } from 'src/components/_admin/ui/fields';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { CopyButton } from 'src/components/_admin/ui/primitives';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';
const WEBHOOK_URLS = {
  steadfast: `${BASE_URL}/api/webhooks/courier/steadfast`,
  pathao: `${BASE_URL}/api/webhooks/courier/pathao`,
  carrybee: `${BASE_URL}/api/webhooks/courier/carrybee`
};

const PROVIDERS = {
  steadfast: { label: 'Steadfast', webhookNote: 'Set the webhook secret as the Bearer token.' },
  pathao: { label: 'Pathao', webhookNote: 'Set the webhook secret in the Pathao merchant dashboard.' },
  carrybee: { label: 'CarryBee', webhookNote: 'Use the webhook integration secret set on the account.' }
};

const CREDENTIAL_FIELDS = {
  pathao: [
    { key: 'clientId', label: 'Client ID', hint: 'From Pathao Merchant → API Credentials' },
    { key: 'clientSecret', label: 'Client secret', secret: true },
    { key: 'username', label: 'Merchant email (username)', hint: 'Needed for the password grant token' },
    { key: 'password', label: 'Merchant password', secret: true },
    { key: 'storeId', label: 'Store ID', hint: 'The Pathao store parcels are sent from' }
  ],
  steadfast: [
    { key: 'apiKey', label: 'API key', secret: true },
    { key: 'secretKey', label: 'Secret key', secret: true },
    { key: 'merchantEmail', label: 'Merchant login email', hint: 'Used for the portal fraud check, which is not subject to API limits' },
    { key: 'merchantPassword', label: 'Merchant login password', secret: true }
  ],
  carrybee: [
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client secret', secret: true },
    { key: 'clientContext', label: 'Client context', secret: true },
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

function SecretInput({ id, value, onChange, placeholder, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
        className="input-ui ops-code w-full pr-10"
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label={show ? 'Hide value' : 'Show value'}
        aria-pressed={show}
      >
        {show ? <MdVisibilityOff size={17} aria-hidden /> : <MdVisibility size={17} aria-hidden />}
      </button>
    </div>
  );
}

function AccountDrawer({ initial, onSave, onClose, saving }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(
    initial ? { ...EMPTY_FORM, ...initial, credentials: { ...(initial.credentials || {}) } } : EMPTY_FORM
  );
  const [nameError, setNameError] = useState('');
  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const setCred = (key, value) => setForm((p) => ({ ...p, credentials: { ...p.credentials, [key]: value } }));
  const fields = CREDENTIAL_FIELDS[form.provider] || [];
  const provider = PROVIDERS[form.provider];

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('Give the account a name.');
      return;
    }
    onSave(form);
  };

  return (
    <Drawer
      title={editing ? `Edit ${initial.name}` : 'Add courier account'}
      eyebrow="Couriers"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add account'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Courier" help={editing ? 'The courier of an existing account cannot change.' : undefined}>
              <select
                value={form.provider}
                disabled={editing}
                onChange={(e) => set({ provider: e.target.value, credentials: {} })}
                className="select-ui w-full"
              >
                {Object.entries(PROVIDERS).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account name" required error={nameError}>
              <input
                value={form.name}
                onChange={(e) => {
                  set({ name: e.target.value });
                  setNameError('');
                }}
                placeholder="e.g. Steadfast — Main"
                className="input-ui"
                autoFocus={!editing}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{provider.label} credentials</h3>
            {editing && <p className="mt-0.5 text-[13px] text-slate-500">Leave a secret blank to keep the one already saved.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <Field key={field.key} label={field.label} help={field.hint}>
                {field.secret ? (
                  <SecretInput
                    value={form.credentials[field.key] || ''}
                    onChange={(e) => setCred(field.key, e.target.value)}
                    placeholder={editing ? 'Unchanged' : ''}
                  />
                ) : (
                  <input value={form.credentials[field.key] || ''} onChange={(e) => setCred(field.key, e.target.value)} className="input-ui" />
                )}
              </Field>
            ))}
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-5">
          <Field
            label="Webhook secret"
            optional
            help="Any random string. Set the same value in the courier dashboard so tracking updates on every parcel status change."
          >
            <input
              value={form.webhookSecret}
              onChange={(e) => set({ webhookSecret: e.target.value })}
              className="input-ui ops-code"
              spellCheck={false}
            />
          </Field>
          <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
            <span className="shrink-0">Webhook URL</span>
            <span className="ops-code min-w-0 flex-1 truncate text-slate-900">{WEBHOOK_URLS[form.provider]}</span>
            <CopyButton value={WEBHOOK_URLS[form.provider]} label={`Copy the ${provider.label} webhook URL`} />
          </div>
        </section>

        <section className="divide-y divide-slate-100 border-t border-slate-200 pt-2">
          <Toggle
            label="Active"
            help="Inactive accounts cannot book new shipments."
            checked={form.isActive}
            onChange={(on) => set({ isActive: on })}
          />
          <Toggle
            label={`Default for ${provider.label}`}
            help="Used when a shipment is booked without choosing an account."
            checked={form.isDefault}
            onChange={(on) => set({ isDefault: on })}
          />
        </section>
      </div>
    </Drawer>
  );
}

export default function CourierAccountsManager() {
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState(null); // null | { account?: object }
  const [balances, setBalances] = useState({});

  const { data, isLoading, isError, error, refetch } = useQuery(['courier-accounts'], api.getCourierAccounts, {
    select: (d) => d?.data ?? []
  });
  const accounts = data || [];
  const invalidate = () => qc.invalidateQueries(['courier-accounts']);

  const create = useMutation(api.createCourierAccount, {
    onSuccess: () => {
      toastSuccess('Courier account added');
      invalidate();
      setDrawer(null);
    },
    onError: (e) => alertError(e, { title: 'The account was not added' })
  });
  const update = useMutation(api.updateCourierAccount, {
    onSuccess: () => {
      toastSuccess('Courier account saved');
      invalidate();
      setDrawer(null);
    },
    onError: (e) => alertError(e, { title: 'The account was not saved' })
  });
  const setDefault = useMutation(api.setDefaultCourierAccount, {
    onSuccess: () => {
      toastSuccess('Default account changed');
      invalidate();
    },
    onError: (e) => alertError(e, { title: 'The default was not changed' })
  });
  const remove = useMutation(api.deleteCourierAccount, {
    onSuccess: () => {
      toastSuccess('Courier account removed');
      invalidate();
    },
    onError: (e) => alertError(e, { title: 'The account was not removed' })
  });

  const handleDelete = async (account) => {
    const confirmed = await confirmDelete({
      title: 'Remove this courier account?',
      subject: account.name,
      text: 'Existing shipments keep their history; you just can’t book new ones with it.',
      confirmText: 'Remove account'
    });
    if (confirmed) remove.mutate(account.id);
  };

  const checkBalance = async (account) => {
    setBalances((p) => ({ ...p, [account.id]: 'Checking…' }));
    try {
      const res = await api.getCourierAccountBalance(account.id);
      setBalances((p) => ({ ...p, [account.id]: `৳${res?.data?.balance ?? '?'}` }));
    } catch (e) {
      setBalances((p) => ({ ...p, [account.id]: 'Could not check' }));
      alertError(e, { title: 'The balance could not be checked' });
    }
  };

  const openAdd = () => setDrawer({});
  const openEdit = (account) => setDrawer({ account });

  const columns = [
    {
      key: 'name',
      label: 'Account',
      render: (account) => (
        <div>
          <p className="text-[13px] font-semibold text-slate-900">{account.name}</p>
          {account.webhookSecret ? (
            <p className="text-xs text-slate-500">Webhook secret set</p>
          ) : (
            <p className="text-xs text-amber-800">No webhook secret — tracking won’t update on its own</p>
          )}
        </div>
      )
    },
    {
      key: 'provider',
      label: 'Courier',
      render: (account) => <Badge>{PROVIDERS[account.provider]?.label || account.provider}</Badge>
    },
    {
      key: 'isDefault',
      label: 'Default',
      render: (account) =>
        account.isDefault ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-900">
            <MdStar size={15} className="text-amber-500" aria-hidden /> Default
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (account) => <RecordStatus status={account.isActive ? 'active' : 'inactive'} />
    },
    {
      key: 'balance',
      label: 'Balance',
      hideBelow: 'md',
      render: (account) =>
        account.provider === 'steadfast' ? (
          <button
            type="button"
            onClick={(e) => {
              stopRow(e);
              checkBalance(account);
            }}
            className="btn-ghost btn-sm"
          >
            {balances[account.id] || 'Check balance'}
          </button>
        ) : (
          <span className="text-slate-400">—</span>
        )
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (account) => (
        <div className="flex items-center justify-end gap-1" onClick={stopRow}>
          <button type="button" onClick={() => openEdit(account)} className="btn-ghost btn-sm">
            Edit
          </button>
          <ActionMenu
            label={`More actions for ${account.name}`}
            items={[
              {
                label: 'Make default',
                icon: MdStar,
                onClick: () => setDefault.mutate(account.id),
                hidden: account.isDefault,
                disabled: setDefault.isLoading
              },
              { label: 'Edit', icon: MdEdit, onClick: () => openEdit(account) },
              { label: 'Remove', icon: MdDelete, tone: 'danger', onClick: () => handleDelete(account) }
            ]}
          />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Courier accounts" subtitle="Accounts used to book shipments — one default per courier.">
        <button type="button" onClick={openAdd} className="btn-brand">
          <MdAdd size={18} aria-hidden /> Add account
        </button>
      </PageHeader>

      <DataTable
        caption="Courier accounts"
        columns={columns}
        data={accounts}
        onRowClick={openEdit}
        rowLabel={(account) => `Edit ${account.name}`}
        selectable={false}
        isLoading={isLoading}
        error={isError ? error : null}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={MdOutlineLocalShipping}
            title="No courier accounts yet"
            hint="Add your Steadfast, Pathao or CarryBee credentials to start booking shipments."
            action={
              <button type="button" onClick={openAdd} className="btn-brand">
                <MdAdd size={18} aria-hidden /> Add account
              </button>
            }
          />
        }
      />

      <Panel title="Webhook setup" description="One-time, per courier. The courier calls this address on every parcel status change.">
        <ul className="divide-y divide-slate-100">
          {Object.entries(PROVIDERS).map(([key, meta]) => (
            <li key={key} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center sm:gap-4">
              <p className="text-[13px] font-medium text-slate-900">{meta.label}</p>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="ops-code min-w-0 truncate text-[13px] text-slate-700">{WEBHOOK_URLS[key]}</span>
                  <CopyButton value={WEBHOOK_URLS[key]} label={`Copy the ${meta.label} webhook URL`} />
                </div>
                <p className="text-xs text-slate-500">{meta.webhookNote}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {drawer && (
        <AccountDrawer
          initial={drawer.account}
          saving={create.isLoading || update.isLoading}
          onSave={(form) => (drawer.account ? update.mutate({ id: drawer.account.id, ...form }) : create.mutate(form))}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
