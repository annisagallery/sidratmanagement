'use client';
import DataTable from 'src/components/_admin/ui/DataTable';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { confirmDelete } from 'src/utils/swal';
import { FiCheck, FiX, FiTrash2, FiPlus, FiCopy, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';
const WEBHOOK_URL = `${BASE_URL}/api/webhook/payment`;

// ── Payment Types ─────────────────────────────────────────────────────────────

function TypeRow({ t, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: t.name,
    slug: t.slug,
    color: t.color,
    accounts: t.accounts?.join(', ') || '',
    isActive: t.isActive
  });

  const save = () => {
    onSave(t.id, {
      ...form,
      accounts: form.accounts
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    });
    setEditing(false);
  };
  const cancel = () => {
    setForm({
      name: t.name,
      slug: t.slug,
      color: t.color,
      accounts: t.accounts?.join(', ') || '',
      isActive: t.isActive
    });
    setEditing(false);
  };

  const inp = 'border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]';

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      <td className="px-4 py-2.5">
        {editing ? (
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inp} />
        ) : (
          <span className="text-sm font-medium text-gray-700">{t.name}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {editing ? (
          <input
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
            className={`${inp} font-mono`}
          />
        ) : (
          <span className="font-mono text-xs text-gray-500">{t.slug}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {editing ? (
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
            className="h-8 w-14 cursor-pointer rounded-md border border-gray-200 p-0.5"
          />
        ) : (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-md border border-gray-200" style={{ backgroundColor: t.color }} />
            <span className="font-mono text-xs text-gray-400">{t.color}</span>
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span
          className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium"
          style={{
            backgroundColor: (editing ? form.color : t.color) + '22',
            color: editing ? form.color : t.color,
            border: `1px solid ${editing ? form.color : t.color}55`
          }}
        >
          {editing ? form.name || 'Preview' : t.name}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {editing ? (
          <input
            value={form.accounts}
            onChange={(e) => setForm((p) => ({ ...p, accounts: e.target.value }))}
            placeholder="01xxx, 01yyy"
            className={inp}
          />
        ) : (
          <span className="text-xs text-gray-500">{t.accounts?.join(', ') || '—'}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <button onClick={save} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md">
                <FiCheck size={14} />
              </button>
              <button onClick={cancel} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
                <FiX size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-2 py-1 text-xs text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] rounded-md"
              >
                Edit
              </button>
              <button onClick={() => onDelete(t)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-md">
                <FiTrash2 size={13} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddTypeRow({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', color: '#6b7280', accounts: '' });

  const submit = () => {
    if (!form.name || !form.slug) return;
    onAdd({
      ...form,
      accounts: form.accounts
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    });
    setForm({ name: '', slug: '', color: '#6b7280', accounts: '' });
    setOpen(false);
  };

  if (!open)
    return (
      <tr>
        <td colSpan={6} className="px-4 py-2">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-xs text-[var(--brand-strong)] hover:text-[var(--brand-strong)]"
          >
            <FiPlus size={13} /> Add type
          </button>
        </td>
      </tr>
    );

  const inp = 'border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]';
  return (
    <tr className="bg-[var(--brand-soft)]/30 border-b border-[var(--brand-ring)]">
      <td className="px-4 py-2.5">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => {
            setForm((p) => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '') }));
          }}
          className={inp}
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          placeholder="slug"
          value={form.slug}
          onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
          className={`${inp} font-mono`}
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
          className="h-8 w-14 cursor-pointer rounded-md border border-gray-200 p-0.5"
        />
      </td>
      <td className="px-4 py-2.5">
        <span
          className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: form.color + '22', color: form.color, border: `1px solid ${form.color}55` }}
        >
          {form.name || 'Preview'}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <input
          placeholder="01xxx, 01yyy"
          value={form.accounts}
          onChange={(e) => setForm((p) => ({ ...p, accounts: e.target.value }))}
          className={inp}
        />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-1 justify-end">
          <button onClick={submit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md">
            <FiCheck size={14} />
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
            <FiX size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function PaymentTypesSection() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries(['payment-types']);

  const { data, isLoading } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, { staleTime: 0 });
  const types = data?.data || [];

  const { mutate: create } = useMutation(api.createPaymentTypeByAdmin, {
    onSuccess: invalidate,
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });
  const { mutate: update } = useMutation(api.updatePaymentTypeByAdmin, { onSuccess: invalidate });
  const { mutate: del } = useMutation(api.deletePaymentTypeByAdmin, { onSuccess: invalidate });

  const handleDelete = async (paymentType) => {
    const confirmed = await confirmDelete({
      subject: paymentType.name,
      text: 'Staff stop seeing it when recording a payment. Payments already recorded against it keep the name.'
    });
    if (confirmed) del(paymentType.id);
  };

  return (
    <section className="bg-white border border-gray-100 rounded-md p-6 shadow-sm space-y-4">
      <div>
        <h2 className="font-semibold text-base text-gray-800">Payment Types</h2>
        <p className="text-xs text-gray-400 mt-0.5">Manage accepted payment methods and their account numbers.</p>
      </div>
      {isLoading ? (
        <div className="h-20 bg-gray-100 animate-pulse rounded-md" />
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <DataTable className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Slug', 'Color', 'Preview', 'Accounts', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <TypeRow
                  key={t.id}
                  t={t}
                  onSave={(id, payload) => update({ id, ...payload })}
                  onDelete={handleDelete}
                />
              ))}
              <AddTypeRow onAdd={create} />
            </tbody>
          </DataTable>
        </div>
      )}
    </section>
  );
}

// ── Webhook ───────────────────────────────────────────────────────────────────

function WebhookSection() {
  const [showSecret, setShowSecret] = useState(false);
  const [secret, setSecret] = useState(null);
  const copiedRef = useRef(false);

  const { isLoading } = useQuery(['webhook-config'], api.getWebhookConfig, {
    staleTime: 60_000,
    onSuccess: (d) => {
      if (secret === null) setSecret(d?.data?.secret || '');
    }
  });

  const { mutate: regen, isLoading: regenning } = useMutation(api.regenerateWebhookSecret, {
    onSuccess: (d) => setSecret(d?.data?.secret || ''),
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const handleRegen = () =>
    Swal.fire({
      title: 'Regenerate secret?',
      text: 'The old secret will stop working immediately.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Regenerate',
      confirmButtonColor: '#ef4444'
    }).then((r) => {
      if (r.isConfirmed) regen();
    });

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire({ title: 'Copied!', icon: 'success', timer: 900, showConfirmButton: false });
  };

  const inpBase =
    'border border-gray-200 rounded-md px-3 py-2 text-sm font-mono flex-1 bg-gray-50 text-gray-600 focus:outline-none';

  return (
    <section className="bg-white border border-gray-100 rounded-md p-6 shadow-sm space-y-5">
      <div>
        <h2 className="font-semibold text-base text-gray-800">Webhook (n8n)</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Point your n8n SMS-parse workflow to this URL. Include the secret as the{' '}
          <code className="bg-gray-100 px-1 rounded-md">X-Webhook-Secret</code> header.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Webhook URL</label>
          <div className="flex gap-2">
            <input readOnly value={WEBHOOK_URL} className={inpBase} />
            <button
              onClick={() => copy(WEBHOOK_URL)}
              className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-500"
            >
              <FiCopy size={14} />
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Secret Key</label>
          <div className="flex gap-2">
            <input
              readOnly
              type={showSecret ? 'text' : 'password'}
              value={isLoading ? 'Loading…' : secret || ''}
              className={inpBase}
            />
            <button
              onClick={() => setShowSecret((v) => !v)}
              className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-500"
            >
              {showSecret ? <FiEyeOff size={14} /> : <FiEye size={14} />}
            </button>
            <button
              onClick={() => secret && copy(secret)}
              className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-500"
            >
              <FiCopy size={14} />
            </button>
            <button
              onClick={handleRegen}
              disabled={regenning}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition disabled:opacity-50"
            >
              <FiRefreshCw size={13} />
              Regenerate
            </button>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-xs text-gray-500 space-y-2">
          <p className="font-semibold text-gray-700">Expected payload from n8n:</p>
          <pre className="font-mono text-xs overflow-x-auto">
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
          <p className="mt-1">
            Header: <code className="bg-gray-100 px-1 rounded-md">X-Webhook-Secret: {'<secret>'}</code>
          </p>
          <p>
            Duplicate <code>trxId</code> returns <code>409</code> — safe to retry.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentSettings() {
  return (
    <div className="space-y-6">
      <PaymentTypesSection />
      <WebhookSection />
    </div>
  );
}
