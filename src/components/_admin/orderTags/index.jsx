'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { MdAdd, MdDeleteOutline, MdLabelOutline } from 'react-icons/md';
import * as api from 'src/services';
import { confirmDelete, toastSuccess, toastError } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Drawer from 'src/components/_admin/ui/Drawer';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';
import { Field, Switch } from 'src/components/_admin/ui/fields';
import { ColorChip } from 'src/components/_admin/shared/StatusBadge';

const PRESET_COLORS = [
  ['#EF4444', 'Red'],
  ['#F97316', 'Orange'],
  ['#EAB308', 'Yellow'],
  ['#22C55E', 'Green'],
  ['#3B82F6', 'Blue'],
  ['#8B5CF6', 'Violet'],
  ['#EC4899', 'Pink'],
  ['#6B7280', 'Grey']
];

function TagDrawer({ initial, saving, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6B7280');
  const [description, setDesc] = useState(initial?.description ?? '');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the tag a name.');
      return;
    }
    onSave({ name: name.trim(), color, description });
  };

  return (
    <Drawer
      eyebrow="Order tags"
      title={initial ? 'Edit tag' : 'New tag'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-brand" disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create tag'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <Field label="Name" required error={error}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="e.g. Urgent"
            className="input-ui"
            autoFocus
          />
        </Field>
        <Field label="Description" optional help="A note on when to use this tag.">
          <input value={description} onChange={(e) => setDesc(e.target.value)} className="input-ui" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-slate-800">Colour</legend>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Tag colour">
            {PRESET_COLORS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={color === value}
                aria-label={label}
                title={label}
                onClick={() => setColor(value)}
                className={`h-8 w-8 rounded-full ring-offset-2 transition ${color === value ? 'ring-2 ring-slate-900' : 'hover:scale-105'}`}
                style={{ backgroundColor: value }}
              />
            ))}
            <label className="ml-1 inline-flex items-center gap-2 text-[13px] text-slate-600">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-md border border-slate-300 p-0.5"
              />
              Custom <span className="font-mono text-xs text-slate-500">{color}</span>
            </label>
          </div>
        </fieldset>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Preview</p>
          <ColorChip color={color}>{name || 'Tag name'}</ColorChip>
        </div>
      </div>
    </Drawer>
  );
}

export default function OrderTagsManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | tag

  const { data, isLoading, isError, error, refetch } = useQuery(['orderTags'], () => api.getOrderTagsByAdmin(), {
    select: (d) => d?.data ?? []
  });

  const invalidate = () => qc.invalidateQueries(['orderTags']);
  const onError = (fallback) => (e) => toastError(e, fallback);

  const create = useMutation(api.createOrderTagByAdmin, {
    onSuccess: () => {
      toastSuccess('Tag created');
      invalidate();
      setEditing(null);
    },
    onError: onError('Could not create the tag.')
  });

  const update = useMutation(api.updateOrderTagByAdmin, {
    onSuccess: (_, vars) => {
      toastSuccess(vars.name ? 'Tag saved' : vars.isActive ? 'Tag turned on' : 'Tag turned off');
      invalidate();
      setEditing(null);
    },
    onError: onError('Could not save the tag.')
  });

  const remove = useMutation(api.deleteOrderTagByAdmin, {
    onSuccess: () => {
      toastSuccess('Tag deleted');
      invalidate();
    },
    onError: onError('Could not delete the tag.')
  });

  const handleDelete = async (tag) => {
    const confirmed = await confirmDelete({
      title: 'Delete this tag?',
      subject: tag.name,
      text: 'The tag comes off every order carrying it. Those orders are otherwise untouched.'
    });
    if (confirmed) remove.mutate(tag.id);
  };

  const columns = [
    { key: 'name', label: 'Tag', render: (tag) => <ColorChip color={tag.color}>{tag.name}</ColorChip> },
    {
      key: 'description',
      label: 'Description',
      hideBelow: 'sm',
      render: (tag) => <span className="text-slate-600">{tag.description || <span className="text-slate-400">—</span>}</span>
    },
    {
      key: 'active',
      label: 'In use',
      render: (tag) => (
        <span className="inline-flex items-center gap-2" onClick={stopRow}>
          <Switch
            checked={tag.isActive}
            onChange={() => update.mutate({ id: tag.id, isActive: !tag.isActive })}
            disabled={update.isLoading}
            label={tag.isActive ? `${tag.name} is on — turn off` : `${tag.name} is off — turn on`}
          />
          <span className="text-[13px] text-slate-600">{tag.isActive ? 'On' : 'Off'}</span>
        </span>
      )
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (tag) => (
        <div className="flex justify-end gap-1" onClick={stopRow}>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(tag)}>
            Edit
          </button>
          <button
            type="button"
            className="btn-icon btn-icon-sm btn-icon-danger"
            onClick={() => handleDelete(tag)}
            aria-label={`Delete ${tag.name}`}
            title="Delete"
          >
            <MdDeleteOutline size={18} />
          </button>
        </div>
      )
    }
  ];

  const addButton = (
    <button type="button" onClick={() => setEditing('new')} className="btn-brand">
      <MdAdd size={18} aria-hidden /> New tag
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Order tags" subtitle="Labels for admin-created orders, such as Urgent, Showroom or Ready-made.">
        {addButton}
      </PageHeader>

      {isError ? (
        <ErrorState error={error} title="Tags could not be loaded" onRetry={refetch} />
      ) : (
        <DataTable
          caption="Order tags"
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          selectable={false}
          rowKey={(tag) => tag.id}
          onRowClick={setEditing}
          rowLabel={(tag) => `Edit tag ${tag.name}`}
          empty={<EmptyState icon={MdLabelOutline} title="No tags yet" action={addButton} />}
        />
      )}

      {editing ? (
        <TagDrawer
          initial={editing === 'new' ? null : editing}
          saving={create.isLoading || update.isLoading}
          onClose={() => setEditing(null)}
          onSave={(payload) => (editing === 'new' ? create.mutate(payload) : update.mutate({ id: editing.id, ...payload }))}
        />
      ) : null}
    </div>
  );
}
