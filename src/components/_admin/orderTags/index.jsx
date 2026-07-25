'use client';
import DataTable from 'src/components/_admin/ui/DataTable';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';

const PRESET_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'];

function TagForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6B7280');
  const [description, setDesc] = useState(initial?.description ?? '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, description });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 border border-gray-200 rounded-md p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tag Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Urgent"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Optional note"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: color === c ? '#1e293b' : 'transparent' }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded-md cursor-pointer border border-gray-300"
            title="Custom color"
          />
          <span className="text-xs text-gray-500 font-mono">{color}</span>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-brand">
          {initial ? 'Save Changes' : 'Create Tag'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function OrderTagsManager() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditing] = useState(null);

  const { data, isLoading } = useQuery(['orderTags'], () => api.getOrderTagsByAdmin(), {
    select: (d) => d?.data ?? []
  });

  const create = useMutation(api.createOrderTagByAdmin, {
    onSuccess: () => {
      qc.invalidateQueries(['orderTags']);
      setShowForm(false);
    },
    onError: (e) => Swal.fire(e?.response?.data?.message || 'Error', '', 'error')
  });

  const update = useMutation(api.updateOrderTagByAdmin, {
    onSuccess: () => {
      qc.invalidateQueries(['orderTags']);
      setEditing(null);
    },
    onError: (e) => Swal.fire(e?.response?.data?.message || 'Error', '', 'error')
  });

  const remove = useMutation(api.deleteOrderTagByAdmin, {
    onSuccess: () => qc.invalidateQueries(['orderTags']),
    onError: (e) => Swal.fire(e?.response?.data?.message || 'Error', '', 'error')
  });

  const toggleActive = (tag) => update.mutate({ id: tag._id, isActive: !tag.isActive });

  const handleDelete = (id) =>
    Swal.fire({
      title: 'Delete this tag?',
      text: 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Delete'
    }).then((r) => r.isConfirmed && remove.mutate(id));

  return (
    <div className="space-y-4">
      <PageHeader title="Order Tags" subtitle="Tags applied to admin-created orders (e.g. Urgent, Showroom, Readymade)">
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-brand">
            + New Tag
          </button>
        )}
      </PageHeader>

      <div className="space-y-4">
        {showForm && <TagForm onSave={(payload) => create.mutate(payload)} onCancel={() => setShowForm(false)} />}

        {isLoading ? (
          <div className="text-center py-10 text-sm text-gray-500">Loading…</div>
        ) : !data?.length ? (
          <div className="text-center py-10 text-sm text-gray-500 border border-dashed border-gray-300 rounded-md">
            No tags yet. Create your first tag above.
          </div>
        ) : (
          <div className="card-ui overflow-hidden">
            <DataTable className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tag
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((tag) => (
                  <React.Fragment key={tag._id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: tag.color }} />
                          <span className="text-sm font-medium text-gray-800">{tag.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{tag.description || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleActive(tag)}
                          className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            tag.isActive
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}
                        >
                          {tag.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditing(editingTag?._id === tag._id ? null : tag)}
                            className="text-xs hover:underline"
                            style={{ color: 'var(--brand-strong)' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(tag._id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingTag?._id === tag._id && (
                      <tr>
                        <td colSpan={4} className="px-4 pb-3">
                          <TagForm
                            initial={tag}
                            onSave={(payload) => update.mutate({ id: tag._id, ...payload })}
                            onCancel={() => setEditing(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </div>
    </div>
  );
}
