'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { FiPlus, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import * as api from 'src/services';
import { confirmDelete, toastSuccess, toastError } from 'src/utils/swal';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Panel from 'src/components/_admin/ui/Panel';
import Tabs from 'src/components/_admin/ui/Tabs';
import { EmptyState, ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';
import { ColorChip } from 'src/components/_admin/shared/StatusBadge';

const MODELS = [
  { id: 'order', label: 'Order statuses' },
  { id: 'orderItem', label: 'Order item statuses' }
];

const TITLES = {
  order: { title: 'Order statuses', noun: 'order' },
  orderItem: { title: 'Order item statuses', noun: 'order item' }
};

function ColorInput({ value, onChange, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={onChange}
        aria-label={label}
        className="h-8 w-10 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
      />
      <span className="font-mono text-xs text-slate-500">{value}</span>
    </span>
  );
}

function StatusRow({ s, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: s.label, color: s.color, sortOrder: s.sortOrder });

  const save = () => {
    if (!form.label.trim()) return;
    onSave(s.id, form);
    setEditing(false);
  };
  const cancel = () => {
    setForm({ label: s.label, color: s.color, sortOrder: s.sortOrder });
    setEditing(false);
  };

  return (
    <tr>
      <td>
        <span className="font-mono text-xs text-slate-600">{s.value}</span>
      </td>
      <td>
        {editing ? (
          <input
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') cancel();
            }}
            aria-label={`Label for ${s.value}`}
            aria-invalid={!form.label.trim()}
            className="input-ui h-8 w-full"
            autoFocus
          />
        ) : (
          <span className="font-medium text-slate-900">{s.label}</span>
        )}
      </td>
      <td>
        {editing ? (
          <ColorInput
            value={form.color}
            onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
            label={`Colour for ${s.value}`}
          />
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded border border-slate-200" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="font-mono text-xs text-slate-500">{s.color}</span>
          </span>
        )}
      </td>
      <td className="hidden md:table-cell">
        <ColorChip color={editing ? form.color : s.color}>{(editing ? form.label : s.label) || 'Preview'}</ColorChip>
      </td>
      <td>
        {editing ? (
          <input
            type="number"
            inputMode="numeric"
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
            aria-label={`Position of ${s.value}`}
            className="input-ui h-8 w-20"
          />
        ) : (
          <span className="tabular-nums text-slate-600">{s.sortOrder}</span>
        )}
      </td>
      <td>
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <button type="button" onClick={save} className="btn-brand btn-sm" disabled={!form.label.trim()}>
                <FiCheck size={15} aria-hidden /> Save
              </button>
              <button type="button" onClick={cancel} className="btn-quiet btn-sm">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className="btn-ghost btn-sm">
                Edit
              </button>
              <button
                type="button"
                aria-label={`Delete ${s.label}`}
                title="Delete"
                onClick={() => onDelete(s)}
                className="btn-icon btn-icon-sm btn-icon-danger"
              >
                <FiTrash2 size={16} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddStatusRow({ model, onAdded, onCancel }) {
  const [form, setForm] = useState({ value: '', label: '', color: '#6b7280', sortOrder: 0 });
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!form.value.trim() || !form.label.trim()) {
      setError('Both a value and a label are needed.');
      return;
    }
    onAdded({ ...form, model });
    onCancel();
  };

  return (
    <>
      <tr className="bg-slate-50">
        <td>
          <input
            placeholder="value_slug"
            value={form.value}
            onChange={(e) => {
              setForm((p) => ({ ...p, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }));
              setError('');
            }}
            aria-label="Value (used by the system)"
            className="input-ui input-mono h-8 w-full"
            spellCheck={false}
            autoFocus
          />
        </td>
        <td>
          <input
            placeholder="Label people see"
            value={form.label}
            onChange={(e) => {
              setForm((p) => ({ ...p, label: e.target.value }));
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            aria-label="Label"
            className="input-ui h-8 w-full"
          />
        </td>
        <td>
          <ColorInput value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} label="Colour" />
        </td>
        <td className="hidden md:table-cell">
          <ColorChip color={form.color}>{form.label || 'Preview'}</ColorChip>
        </td>
        <td>
          <input
            type="number"
            inputMode="numeric"
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
            aria-label="Position"
            className="input-ui h-8 w-20"
          />
        </td>
        <td>
          <div className="flex justify-end gap-1">
            <button type="button" onClick={handleAdd} className="btn-brand btn-sm">
              <FiCheck size={15} aria-hidden /> Add
            </button>
            <button type="button" aria-label="Cancel" title="Cancel" onClick={onCancel} className="btn-icon btn-icon-sm">
              <FiX size={16} />
            </button>
          </div>
        </td>
      </tr>
      {error ? (
        <tr className="bg-slate-50">
          <td colSpan={6} className="!pt-0">
            <p className="text-[13px] font-medium text-rose-700" role="alert">
              {error}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function StatusManager({ model }) {
  const [selectedModel, setSelectedModel] = useState(model || 'order');
  const [adding, setAdding] = useState(false);
  const activeModel = model || selectedModel;
  const { title, noun } = TITLES[activeModel] || TITLES.order;
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery(
    ['statuses', activeModel],
    () => api.getStatusesByModel(activeModel),
    { staleTime: 0 }
  );
  const statuses = data?.data || [];

  const invalidate = () => qc.invalidateQueries(['statuses', activeModel]);
  const onError = (fallback) => (e) => toastError(e, fallback);

  const { mutate: createStatus } = useMutation(api.createStatusByAdmin, {
    onSuccess: () => {
      toastSuccess('Status added');
      invalidate();
    },
    onError: onError('Could not add the status.')
  });

  const { mutate: updateStatus } = useMutation(api.updateStatusByAdmin, {
    onSuccess: () => {
      toastSuccess('Status saved');
      invalidate();
    },
    onError: onError('Could not save the status.')
  });

  const { mutate: deleteStatus } = useMutation(api.deleteStatusByAdmin, {
    onSuccess: () => {
      toastSuccess('Status deleted');
      invalidate();
    },
    onError: onError('Could not delete the status.')
  });

  const handleDelete = async (status) => {
    const confirmed = await confirmDelete({
      title: 'Delete this status?',
      subject: status.label || status.value,
      text: 'Records already in this status keep it, but nothing new can be moved here.'
    });
    if (confirmed) deleteStatus(status.id);
  };

  return (
    <div className="space-y-6">
      {!model && <Tabs tabs={MODELS} value={activeModel} onChange={(id) => { setSelectedModel(id); setAdding(false); }} label="Status type" />}

      <Panel
        title={title}
        description={`Labels, colours and order of the statuses an ${noun} moves through. Changes apply everywhere at once.`}
        action={
          !adding && (
            <button type="button" className="btn-brand btn-sm" onClick={() => setAdding(true)}>
              <FiPlus size={15} aria-hidden /> Add status
            </button>
          )
        }
        bodyClassName="!p-0 !pt-4"
      >
        {isError ? (
          <div className="p-5">
            <ErrorState error={error} title="Statuses could not be loaded" onRetry={refetch} />
          </div>
        ) : isLoading ? (
          <LoadingBlock bare />
        ) : (
          <div className="border-t border-slate-200">
            <GlobalTable>
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <th scope="col">Value</th>
                  <th scope="col">Label</th>
                  <th scope="col">Colour</th>
                  <th scope="col" className="hidden md:table-cell">
                    Preview
                  </th>
                  <th scope="col">Position</th>
                  <th scope="col" className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {adding && <AddStatusRow model={activeModel} onAdded={createStatus} onCancel={() => setAdding(false)} />}
                {statuses.map((s) => (
                  <StatusRow
                    key={s.id}
                    s={s}
                    onSave={(id, payload) => updateStatus({ id, ...payload })}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </GlobalTable>
            {!statuses.length && !adding ? <EmptyState compact title={`No ${noun} statuses yet`} /> : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
