'use client';
import DataTable from 'src/components/_admin/ui/DataTable';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import { FiPlus, FiTrash2, FiCheck, FiX } from 'react-icons/fi';

const MODELS = [
  { key: 'order', label: 'Order' },
  { key: 'orderItem', label: 'Order Item' }
];

function StatusRow({ s, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: s.label, color: s.color, sortOrder: s.sortOrder });

  const save = () => {
    onSave(s.id, form);
    setEditing(false);
  };
  const cancel = () => {
    setForm({ label: s.label, color: s.color, sortOrder: s.sortOrder });
    setEditing(false);
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      <td className="px-4 py-2.5">
        <span className="text-xs font-mono text-gray-500">{s.value}</span>
      </td>
      <td className="px-4 py-2.5">
        {editing ? (
          <input
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            className="border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
          />
        ) : (
          <span className="text-sm text-gray-700">{s.label}</span>
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
          <span className="inline-flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-md border border-gray-200 inline-block"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-xs text-gray-400 font-mono">{s.color}</span>
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span
          className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: s.color + '22', color: s.color, border: `1px solid ${s.color}55` }}
        >
          {s.label}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {editing ? (
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
            className="border rounded-md px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
          />
        ) : (
          <span className="text-sm text-gray-500">{s.sortOrder}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <button onClick={save} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition">
                <FiCheck size={14} />
              </button>
              <button onClick={cancel} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition">
                <FiX size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-2 py-1 text-xs text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] rounded-md transition"
              >
                Edit
              </button>
              <button onClick={() => onDelete(s.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition">
                <FiTrash2 size={13} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddStatusRow({ model, onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ value: '', label: '', color: '#6b7280', sortOrder: 0 });

  const handleAdd = () => {
    if (!form.value.trim() || !form.label.trim()) return;
    onAdded({ ...form, model });
    setForm({ value: '', label: '', color: '#6b7280', sortOrder: 0 });
    setOpen(false);
  };

  if (!open)
    return (
      <tr>
        <td colSpan={6} className="px-4 py-2">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-xs text-[var(--brand-strong)] hover:text-[var(--brand-strong)] transition"
          >
            <FiPlus size={13} /> Add status
          </button>
        </td>
      </tr>
    );

  return (
    <tr className="bg-[var(--brand-soft)]/40 border-b border-[var(--brand-ring)]">
      <td className="px-4 py-2.5">
        <input
          placeholder="value (slug)"
          value={form.value}
          onChange={(e) => setForm((p) => ({ ...p, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
          className="border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          placeholder="Label"
          value={form.label}
          onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          className="border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
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
          {form.label || 'Preview'}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <input
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
          className="border rounded-md px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
        />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-1 justify-end">
          <button onClick={handleAdd} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition">
            <FiCheck size={14} />
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition">
            <FiX size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function StatusManager({ model }) {
  const [selectedModel, setSelectedModel] = useState(model || 'order');
  const activeModel = model || selectedModel;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(['statuses', activeModel], () => api.getStatusesByModel(activeModel), {
    staleTime: 0
  });
  const statuses = data?.data || [];

  const invalidate = () => qc.invalidateQueries(['statuses', activeModel]);

  const { mutate: createStatus } = useMutation(api.createStatusByAdmin, {
    onSuccess: invalidate,
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const { mutate: updateStatus } = useMutation(api.updateStatusByAdmin, {
    onSuccess: invalidate,
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const { mutate: deleteStatus } = useMutation(api.deleteStatusByAdmin, {
    onSuccess: invalidate,
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Delete status?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444'
    }).then((r) => {
      if (r.isConfirmed) deleteStatus(id);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-800">
          {activeModel === 'orderItem' ? 'Order Item Statuses' : 'Order Statuses'}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Manage status labels, colors, and display order. Changes apply everywhere instantly.
        </p>
      </div>

      {!model && (
        <div className="flex gap-1 border-b border-gray-200">
          {MODELS.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedModel(m.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${activeModel === m.key ? 'border-[var(--brand)] text-[var(--brand-strong)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <DataTable className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Value</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Label</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Color</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Preview</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Order</th>
                <th className="px-4 py-2.5 text-right text-xs text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => (
                <StatusRow
                  key={s.id}
                  s={s}
                  onSave={(id, payload) => updateStatus({ id, ...payload })}
                  onDelete={handleDelete}
                />
              ))}
              <AddStatusRow model={activeModel} onAdded={createStatus} />
            </tbody>
          </DataTable>
        </div>
      )}
    </div>
  );
}
