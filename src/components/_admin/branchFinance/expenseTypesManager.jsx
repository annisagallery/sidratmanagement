'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { MdAdd, MdCheck, MdClose, MdDeleteOutline, MdEdit } from 'react-icons/md';
import { FiTag } from 'react-icons/fi';

import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable from 'src/components/_admin/ui/DataTable';

const EMPTY = { name: '', description: '', isActive: true };

function TypeEditor({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <tr className="bg-slate-50/60">
      <td className="px-3 py-2">
        <input className="input-ui w-full" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Utility bills" />
      </td>
      <td className="px-3 py-2">
        <input className="input-ui w-full" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="What belongs in this category" />
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button className="btn-icon text-emerald-600" disabled={saving} onClick={() => onSave(form)} aria-label="Save type">
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

export default function ExpenseTypesManager() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data, isLoading } = useQuery(['admin-expense-types'], api.getExpenseTypesByAdmin);
  const types = data?.data || [];

  const refresh = () => queryClient.invalidateQueries(['admin-expense-types']);

  const createMutation = useMutation(api.createExpenseTypeByAdmin, {
    onSuccess: () => { toast.success('Expense type added'); refresh(); setAdding(false); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not add the type')
  });
  const updateMutation = useMutation(api.updateExpenseTypeByAdmin, {
    onSuccess: () => { toast.success('Expense type updated'); refresh(); setEditingId(null); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not update the type')
  });
  const deleteMutation = useMutation(api.deleteExpenseTypeByAdmin, {
    onSuccess: () => { toast.success('Expense type removed'); refresh(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not remove the type')
  });

  const save = (form, id) => {
    if (!form.name.trim()) return toast.error('Name is required');
    const payload = { name: form.name.trim(), description: form.description.trim(), isActive: form.isActive };
    if (id) updateMutation.mutate({ id, ...payload });
    else createMutation.mutate(payload);
  };

  const remove = async (type) => {
    const confirmed = await Swal.fire({
      title: `Remove ${type.name}?`,
      text: 'Branches can no longer pick it. Existing expenses keep the name.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove'
    });
    if (confirmed.isConfirmed) deleteMutation.mutate(type._id);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Expense Types" subtitle="Categories branches choose from when recording expenses" icon={FiTag}>
        <button className="btn-brand h-10" onClick={() => setAdding(true)}>
          <MdAdd size={16} /> Add type
        </button>
      </PageHeader>

      <DataTable isLoading={isLoading}>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {['Name', 'Description', 'Active', ''].map((label, i) => (
              <th key={i} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${i === 2 ? 'text-center' : 'text-left'}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {types.length === 0 && !adding && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400">
                No expense types yet — branches can't record expenses until you add some.
              </td>
            </tr>
          )}
          {types.map((type) =>
            editingId === type._id ? (
              <TypeEditor
                key={type._id}
                initial={{ name: type.name, description: type.description || '', isActive: type.isActive }}
                saving={updateMutation.isLoading}
                onSave={(form) => save(form, type._id)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <tr key={type._id} className="transition hover:bg-slate-50">
                <td className="px-3 py-2 text-[13px] font-semibold text-slate-700">{type.name}</td>
                <td className="px-3 py-2 text-[13px] text-slate-500">{type.description || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${type.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                    {type.isActive ? 'active' : 'off'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button className="btn-icon" onClick={() => setEditingId(type._id)} aria-label={`Edit ${type.name}`}>
                      <MdEdit size={15} />
                    </button>
                    <button className="btn-icon text-red-400 hover:text-red-600" onClick={() => remove(type)} aria-label={`Remove ${type.name}`}>
                      <MdDeleteOutline size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
          {adding && (
            <TypeEditor initial={EMPTY} saving={createMutation.isLoading} onSave={(form) => save(form, null)} onCancel={() => setAdding(false)} />
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
