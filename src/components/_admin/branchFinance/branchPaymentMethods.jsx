'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { MdAdd, MdCheck, MdClose, MdDeleteOutline, MdEdit } from 'react-icons/md';
import { BsCreditCard2Front } from 'react-icons/bs';

import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable from 'src/components/_admin/ui/DataTable';
import BranchSelect from './BranchSelect';

const EMPTY = { name: '', color: '#6b7280', accounts: '', isActive: true };

const parseAccounts = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function MethodEditor({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <tr className="bg-slate-50/60">
      <td className="px-3 py-2">
        <input className="input-ui w-full" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. bKash" />
      </td>
      <td className="px-3 py-2">
        <input className="input-ui w-full" value={form.accounts} onChange={(e) => set({ accounts: e.target.value })} placeholder="Account numbers, comma-separated" />
      </td>
      <td className="px-3 py-2 text-center">
        <input type="color" className="h-8 w-10 cursor-pointer rounded-md border border-slate-200" value={form.color} onChange={(e) => set({ color: e.target.value })} />
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button className="btn-icon text-emerald-600" disabled={saving} onClick={() => onSave(form)} aria-label="Save method">
            <MdCheck size={16} />
          </button>
          <button className="btn-icon" onClick={onCancel} aria-label="Cancel">
            <MdClose size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function BranchPaymentMethods() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data, isLoading } = useQuery(
    ['admin-branch-payment-methods', branchId],
    () => api.getBranchPaymentMethodsByAdmin(branchId),
    { enabled: Boolean(branchId) }
  );
  const methods = data?.data || [];

  const refresh = () => queryClient.invalidateQueries(['admin-branch-payment-methods', branchId]);

  const createMutation = useMutation(api.createBranchPaymentMethodByAdmin, {
    onSuccess: () => { toast.success('Method added'); refresh(); setAdding(false); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not add the method')
  });
  const updateMutation = useMutation(api.updateBranchPaymentMethodByAdmin, {
    onSuccess: () => { toast.success('Method updated'); refresh(); setEditingId(null); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not update the method')
  });
  const deleteMutation = useMutation(api.deleteBranchPaymentMethodByAdmin, {
    onSuccess: () => { toast.success('Method removed'); refresh(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not remove the method')
  });

  const save = (form, id) => {
    if (!form.name.trim()) return toast.error('Name is required');
    const payload = { branchId, name: form.name.trim(), color: form.color, accounts: parseAccounts(form.accounts), isActive: form.isActive };
    if (id) updateMutation.mutate({ id, ...payload });
    else createMutation.mutate(payload);
  };

  const remove = async (method) => {
    const confirmed = await Swal.fire({
      title: `Remove ${method.name}?`,
      text: 'It disappears from that branch\'s checkout immediately.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove'
    });
    if (confirmed.isConfirmed) deleteMutation.mutate({ branchId, id: method.id });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Branch Payment Methods" subtitle="Each branch has its own list — cash is always implicit" icon={BsCreditCard2Front}>
        <BranchSelect value={branchId} onChange={(value) => { setBranchId(value); setAdding(false); setEditingId(null); }} />
        {branchId && (
          <button className="btn-brand h-10" onClick={() => setAdding(true)}>
            <MdAdd size={16} /> Add method
          </button>
        )}
      </PageHeader>

      {!branchId ? (
        <div className="card-ui p-10 text-center text-sm text-slate-400">Select a branch to manage its payment methods.</div>
      ) : (
        <DataTable isLoading={isLoading}>
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {['Name', 'Accounts', 'Color', 'Active', ''].map((label, i) => (
                <th key={i} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${i >= 2 && i <= 3 ? 'text-center' : 'text-left'}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {methods.length === 0 && !adding && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">
                  No methods yet — this branch's checkout offers Cash only.
                </td>
              </tr>
            )}
            {methods.map((method) =>
              editingId === method.id ? (
                <MethodEditor
                  key={method.id}
                  initial={{ name: method.name, color: method.color, accounts: (method.accounts || []).join(', '), isActive: method.isActive }}
                  saving={updateMutation.isLoading}
                  onSave={(form) => save(form, method.id)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr key={method.id} className="transition hover:bg-slate-50">
                  <td className="px-3 py-2 text-[13px] font-semibold text-slate-700">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-md align-middle" style={{ backgroundColor: method.color }} />
                    {method.name}
                  </td>
                  <td className="px-3 py-2 text-[13px] text-slate-500">{(method.accounts || []).join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-center text-[13px] text-slate-500">{method.color}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${method.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                      {method.isActive ? 'active' : 'off'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button className="btn-icon" onClick={() => setEditingId(method.id)} aria-label={`Edit ${method.name}`}>
                        <MdEdit size={15} />
                      </button>
                      <button className="btn-icon text-red-400 hover:text-red-600" onClick={() => remove(method)} aria-label={`Remove ${method.name}`}>
                        <MdDeleteOutline size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {adding && (
              <MethodEditor initial={EMPTY} saving={createMutation.isLoading} onSave={(form) => save(form, null)} onCancel={() => setAdding(false)} />
            )}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
