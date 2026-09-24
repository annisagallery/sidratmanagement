'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { confirmDelete } from 'src/utils/swal';
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheck,
  FiCopy,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiRefreshCw,
  FiSmartphone,
  FiTrash2,
  FiX
} from 'react-icons/fi';
import PageHeader from 'src/components/_admin/ui/PageHeader';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
const WEBHOOK_URL = `${BASE_URL}/api/webhook/payment`;

// What the customer is told to do differs per wallet. A personal bKash number
// takes Send Money, a merchant till takes Payment, an agent takes Cash Out —
// telling everyone "Send Money" routes real money to the wrong place.
const ACCOUNT_TYPES = [
  { value: 'personal', label: 'Personal', action: 'Send Money' },
  { value: 'merchant', label: 'Merchant', action: 'Payment' },
  { value: 'agent', label: 'Agent', action: 'Cash Out' }
];

const actionFor = (accountType) =>
  ACCOUNT_TYPES.find((a) => a.value === accountType)?.action || 'Send Money';

function Section({ title, description, children, id }) {
  return (
    <section id={id} className="card-ui p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function CopyField({ label, value, type = 'text', children }) {
  const copy = () => {
    navigator.clipboard?.writeText(value);
    Swal.fire({ title: 'Copied', icon: 'success', timer: 900, showConfirmButton: false });
  };
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <div className="flex gap-2">
        <input readOnly type={type} value={value} className="input-ui flex-1 bg-slate-50 font-mono text-xs text-slate-600" />
        {children}
        <button type="button" onClick={copy} className="btn-icon" title={`Copy ${label.toLowerCase()}`} aria-label={`Copy ${label.toLowerCase()}`}>
          <FiCopy size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Payment methods ───────────────────────────────────────────────────────────

const emptyForm = {
  name: '',
  slug: '',
  color: '#6b7280',
  accounts: '',
  accountType: 'personal',
  instructions: '',
  logoUrl: '',
  isActive: true
};

const toForm = (type) => ({
  name: type.name || '',
  slug: type.slug || '',
  color: type.color || '#6b7280',
  accounts: type.accounts?.join(', ') || '',
  accountType: type.accountType || 'personal',
  instructions: type.instructions || '',
  logoUrl: type.logoUrl || '',
  isActive: type.isActive !== false
});

const toPayload = (form) => ({
  ...form,
  accounts: form.accounts
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
});

function MethodForm({ form, setForm, onSave, onCancel, saving }) {
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
                // Only follow the name while the slug has not been set by hand:
                // changing it later would orphan payments recorded against it.
                slug: current.slug ? current.slug : event.target.value.toLowerCase().replace(/\s+/g, '')
              }))
            }
            placeholder="bKash"
            className="input-ui"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Short code</label>
          <input
            value={form.slug}
            onChange={(event) => setForm((c) => ({ ...c, slug: event.target.value.toLowerCase().replace(/\s+/g, '') }))}
            placeholder="bkash"
            className="input-ui font-mono"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Account numbers</label>
          <input
            value={form.accounts}
            onChange={set('accounts')}
            placeholder="01700000000, 01800000000"
            className="input-ui font-mono"
          />
          <p className="mt-1 text-[11px] text-slate-400">Separate several numbers with commas.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Account kind</label>
          <select value={form.accountType} onChange={set('accountType')} className="select-ui w-full">
            {ACCOUNT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — customer taps {option.action}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Colour</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={set('color')}
              className="h-9 w-14 cursor-pointer rounded-md border border-slate-200 p-0.5"
              aria-label="Method colour"
            />
            <span className="font-mono text-xs text-slate-400">{form.color}</span>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Extra instruction <span className="text-slate-400">(optional)</span>
          </label>
          <input
            value={form.instructions}
            onChange={set('instructions')}
            placeholder="Do not use the reference field"
            className="input-ui"
          />
          <p className="mt-1 text-[11px] text-slate-400">Shown to the customer under the payment steps.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Logo URL <span className="text-slate-400">(optional)</span>
          </label>
          <input value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://…/bkash.svg" className="input-ui" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm((c) => ({ ...c, isActive: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          Customers can pay with this
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost h-8 px-3 text-xs">
            <FiX size={13} /> Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!form.name.trim() || !form.slug.trim() || saving}
            className="btn-brand h-8 px-3 text-xs"
          >
            <FiCheck size={13} /> Save method
          </button>
        </div>
      </div>
    </div>
  );
}

// A method card shows the setting as the sentence the customer will be given.
// The fields are the same ones the old table held; reading them back as an
// instruction is what makes a wrong account kind obvious before money moves.
function MethodCard({ type, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(type));

  const startEdit = () => {
    setForm(toForm(type));
    setEditing(true);
  };

  const save = () => {
    onSave(type.id, toPayload(form));
    setEditing(false);
  };

  const inactive = type.isActive === false;
  const accounts = type.accounts?.length ? type.accounts : null;

  return (
    <div className={`rounded-md border p-4 transition ${inactive ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 h-8 w-8 shrink-0 rounded-md border"
          style={{ backgroundColor: (type.color || '#6b7280') + '22', borderColor: (type.color || '#6b7280') + '55' }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{type.name}</h3>
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{type.slug}</code>
            {inactive && (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Hidden from customers
              </span>
            )}
          </div>

          {!editing && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
              Customers tap <strong className="font-semibold text-slate-800">{actionFor(type.accountType)}</strong>
              {accounts ? (
                <>
                  {' '}to{' '}
                  {accounts.map((account, index) => (
                    <span key={account}>
                      {index > 0 && ' or '}
                      <span className="font-mono text-slate-800">{account}</span>
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-amber-600"> — but no account number is set, so there is nowhere to send it</span>
              )}
              .
            </p>
          )}

          {!editing && type.instructions && (
            <p className="mt-1 border-l-2 border-slate-200 pl-2 text-xs italic text-slate-500">“{type.instructions}”</p>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={startEdit} className="btn-ghost h-8 px-3 text-xs">
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(type)}
              className="btn-icon h-8 w-8 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              aria-label={`Remove ${type.name}`}
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <MethodForm form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

function PaymentMethodsSection() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const invalidate = () => qc.invalidateQueries(['payment-types']);
  const onError = (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error');

  const { data, isLoading } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, { staleTime: 0 });
  const types = data?.data || [];
  const { data: checkoutSettingsData, isLoading: settingsLoading } = useQuery(
    ['checkout-payment-settings'],
    api.getCheckoutPaymentSettings,
    { staleTime: 0 }
  );
  const checkoutSettings = checkoutSettingsData?.data || {
    cashOnDeliveryEnabled: true,
    onlinePaymentEnabled: true
  };

  const { mutate: create, isLoading: creating } = useMutation(api.createPaymentTypeByAdmin, {
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setAdding(false);
    },
    onError
  });
  const { mutate: update } = useMutation(api.updatePaymentTypeByAdmin, { onSuccess: invalidate, onError });
  const { mutate: remove } = useMutation(api.deletePaymentTypeByAdmin, { onSuccess: invalidate, onError });
  const { mutate: updateCheckoutSettings, isLoading: savingCheckoutSettings } = useMutation(
    api.updateCheckoutPaymentSettings,
    {
      onSuccess: (response) => qc.setQueryData(['checkout-payment-settings'], response),
      onError
    }
  );

  const setCheckoutOption = (key, checked) => {
    updateCheckoutSettings({ ...checkoutSettings, [key]: checked });
  };

  const handleDelete = async (type) => {
    const confirmed = await confirmDelete({
      subject: type.name,
      text: 'Staff stop seeing it when recording a payment, and customers stop being offered it. Payments already recorded against it keep the name.'
    });
    if (confirmed) remove(type.id);
  };

  return (
    <Section
      id="methods"
      title="Payment methods"
      description="What a customer is offered at checkout, and the exact instruction they are given. The account kind decides that instruction — a personal number takes Send Money, a merchant till takes Payment, and getting it wrong sends real money to the wrong place."
    >
      <div className="mb-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        {[
          {
            key: 'cashOnDeliveryEnabled',
            label: 'Cash on Delivery',
            description: 'Show Cash on Delivery at ecommerce checkout.'
          },
          {
            key: 'onlinePaymentEnabled',
            label: 'Online payment',
            description: 'Show the online payment option at ecommerce checkout.'
          }
        ].map((option) => (
          <label
            key={option.key}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-slate-200 bg-white px-3 py-3"
          >
            <span>
              <span className="block text-sm font-semibold text-slate-800">{option.label}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.description}</span>
            </span>
            <span className="relative shrink-0">
              <input
                type="checkbox"
                checked={checkoutSettings[option.key] !== false}
                disabled={settingsLoading || savingCheckoutSettings}
                onChange={(event) => setCheckoutOption(option.key, event.target.checked)}
                className="peer sr-only"
              />
              <span className="block h-6 w-10 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((key) => (
            <div key={key} className="h-28 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {types.length === 0 && !adding && (
            <div className="rounded-md border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">No payment methods yet</p>
              <p className="mt-0.5 text-xs text-slate-400">Add one to start taking payments at checkout.</p>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {types.map((type) => (
              <MethodCard key={type.id} type={type} onSave={(id, payload) => update({ id, ...payload })} onDelete={handleDelete} />
            ))}
          </div>

          {adding ? (
            <div className="rounded-md border p-4" style={{ borderColor: 'var(--brand-ring)', backgroundColor: 'var(--brand-soft)' }}>
              <h3 className="mb-3 text-sm font-bold text-slate-900">New payment method</h3>
              <MethodForm
                form={form}
                setForm={setForm}
                saving={creating}
                onSave={() => create(toPayload(form))}
                onCancel={() => {
                  setForm(emptyForm);
                  setAdding(false);
                }}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="btn-ghost">
              <FiPlus size={14} /> Add payment method
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

// ── Collector phones ──────────────────────────────────────────────────────────

// Settings that decide how money arrives are worth nothing if the phone that
// reads the confirmation SMS is off. The state belongs on this page, next to
// the methods it makes work.
function CollectorSection() {
  const { data } = useQuery(['sms-devices-status'], api.getSmsDevices, { staleTime: 30_000, retry: false });
  const devices = data?.data || [];
  const offline = devices.filter((device) => device.status === 'offline');
  const active = devices.filter((device) => device.isActive);

  return (
    <Section
      id="collector"
      title="Collector phones"
      description="The phones that read payment confirmation SMS and forward them here. Without one, every payment has to be checked by hand."
    >
      {offline.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <FiAlertTriangle className="mt-0.5 shrink-0" size={14} />
          <span>
            <strong>
              {offline.length} phone{offline.length > 1 ? 's are' : ' is'} offline.
            </strong>{' '}
            Payment SMS are not being collected right now.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-4">
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <FiSmartphone size={15} className="text-slate-400" />
          {devices.length === 0 ? (
            'No phone paired yet'
          ) : (
            <span>
              <strong className="font-semibold text-slate-800">{active.length}</strong> paired
              {offline.length > 0 && <span className="text-rose-600"> · {offline.length} offline</span>}
            </span>
          )}
        </p>
        <Link href="/payments/devices" className="btn-ghost">
          Manage phones <FiArrowRight size={14} />
        </Link>
      </div>
    </Section>
  );
}

// ── Webhook ───────────────────────────────────────────────────────────────────

function WebhookSection() {
  const [showSecret, setShowSecret] = useState(false);
  const [secret, setSecret] = useState(null);
  const seeded = useRef(false);

  const { isLoading } = useQuery(['webhook-config'], api.getWebhookConfig, {
    staleTime: 60_000,
    onSuccess: (response) => {
      if (!seeded.current) {
        seeded.current = true;
        setSecret(response?.data?.secret || '');
      }
    }
  });

  const { mutate: regenerate, isLoading: regenerating } = useMutation(api.regenerateWebhookSecret, {
    onSuccess: (response) => setSecret(response?.data?.secret || ''),
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const handleRegenerate = () =>
    Swal.fire({
      title: 'Regenerate the secret?',
      text: 'Anything posting payments with the old secret stops working immediately.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Regenerate',
      confirmButtonColor: '#ef4444'
    }).then((result) => result.isConfirmed && regenerate());

  return (
    <Section
      id="webhook"
      title="Payments from an outside system"
      description="An address another system can post a payment to. Collector phones are the everyday path — this stays for anything outside Sidrat that needs to record one."
    >
      <div className="space-y-3">
        <CopyField label="Address to post to" value={WEBHOOK_URL} />
        <CopyField label="Secret" value={isLoading ? 'Loading…' : secret || ''} type={showSecret ? 'text' : 'password'}>
          <button
            type="button"
            onClick={() => setShowSecret((value) => !value)}
            className="btn-icon"
            aria-label={showSecret ? 'Hide secret' : 'Show secret'}
          >
            {showSecret ? <FiEyeOff size={14} /> : <FiEye size={14} />}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="btn-icon text-rose-500 hover:border-rose-200 hover:bg-rose-50"
            title="Regenerate secret"
            aria-label="Regenerate secret"
          >
            <FiRefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
          </button>
        </CopyField>

        <details className="rounded-md border border-slate-200">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600">
            What to send
          </summary>
          <div className="space-y-2 border-t border-slate-100 p-3 text-xs text-slate-500">
            <p>
              Send the secret as the header{' '}
              <code className="rounded bg-slate-100 px-1 font-mono">X-Webhook-Secret</code>, with a JSON body:
            </p>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {JSON.stringify(
                {
                  trxId: 'TXN123',
                  amount: 500,
                  type: 'bkash',
                  account: '01700000000',
                  senderAccount: '01800000000',
                  note: 'Original SMS'
                },
                null,
                2
              )}
            </pre>
            <p>
              A repeated <code className="rounded bg-slate-100 px-1 font-mono">trxId</code> answers{' '}
              <code className="rounded bg-slate-100 px-1 font-mono">409</code> and records nothing, so retrying is safe.
            </p>
          </div>
        </details>
      </div>
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentSettings() {
  return (
    <div className="space-y-4">
      <PageHeader title="Payment settings" subtitle="How money comes in, and what customers are told to do" />
      <div className="space-y-4">
        <PaymentMethodsSection />
        <CollectorSection />
        <WebhookSection />
      </div>
    </div>
  );
}
