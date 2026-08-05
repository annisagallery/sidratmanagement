'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { alertError, confirmDelete } from 'src/utils/swal';
import {
  MdAdd,
  MdCheck,
  MdChevronRight,
  MdClose,
  MdDelete,
  MdEdit,
  MdImage,
  MdPalette,
  MdSearch,
  MdTextFields
} from 'react-icons/md';
import { TbAdjustments } from 'react-icons/tb';
import {
  createAttributeByAdmin,
  createAttributeValueByAdmin,
  deleteAttributeByAdmin,
  deleteAttributeValueByAdmin,
  getAllAttributesWithValues,
  updateAttributeByAdmin,
  updateAttributeValueByAdmin
} from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';

const TYPE_META = {
  text: {
    label: 'Text',
    description: 'Names, sizes, materials and other written options',
    icon: MdTextFields,
    badge: 'bg-slate-100 text-slate-700'
  },
  color: {
    label: 'Color',
    description: 'Colour options shown with a visual swatch',
    icon: MdPalette,
    badge: 'bg-rose-50 text-rose-700'
  },
  image: {
    label: 'Image',
    description: 'Pattern or finish options represented by an image',
    icon: MdImage,
    badge: 'bg-sky-50 text-sky-700'
  }
};

const inputClass =
  'min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]';

function TypePicker({ value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-slate-700">Display type</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {Object.entries(TYPE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(key)}
              className={`flex min-h-12 items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
                selected
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon size={19} aria-hidden="true" />
              {meta.label}
              {selected && <MdCheck className="ml-auto" size={18} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function NewAttributeForm({ onCreate, onCancel, saving }) {
  const [form, setForm] = useState({ name: '', type: 'text' });
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      inputRef.current?.focus();
      return;
    }
    onCreate({ ...form, name: form.name.trim() });
  };

  return (
    <form onSubmit={submit} className="card-ui overflow-hidden" aria-labelledby="new-attribute-title">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 id="new-attribute-title" className="text-sm font-bold text-slate-900">
          Create an attribute
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Add the group first. You can add its individual values from the workspace below.
        </p>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(360px,1.2fr)_auto] lg:items-end">
        <div>
          <label htmlFor="new-attribute-name" className="mb-2 block text-xs font-semibold text-slate-700">
            Attribute name <span className="text-red-600">*</span>
          </label>
          <input
            id="new-attribute-name"
            ref={inputRef}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Size or Fabric"
            className={inputClass}
          />
        </div>
        <TypePicker value={form.type} onChange={(type) => setForm((current) => ({ ...current, type }))} />
        <div className="flex gap-2 lg:justify-end">
          <button type="button" onClick={onCancel} className="btn-ghost min-h-11">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand min-h-11 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Creating...' : 'Create attribute'}
          </button>
        </div>
      </div>
    </form>
  );
}

function AttributePreview({ attr }) {
  const values = (attr.values || []).filter((value) => value.active !== false);

  if (attr.type === 'color' && values.some((value) => value.colorHex)) {
    return (
      <span className="flex -space-x-1" aria-hidden="true">
        {values.slice(0, 4).map((value) => (
          <span
            key={value.id}
            className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: value.colorHex || '#e2e8f0' }}
          />
        ))}
      </span>
    );
  }

  const MetaIcon = (TYPE_META[attr.type] || TYPE_META.text).icon;
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500" aria-hidden="true">
      <MetaIcon size={17} />
    </span>
  );
}

function AttributeRail({ attributes, selectedId, onSelect, query, onQueryChange }) {
  return (
    <aside className="card-ui overflow-hidden" aria-label="Attribute list">
      <div className="border-b border-slate-200 p-3">
        <label htmlFor="attribute-search" className="sr-only">
          Search attributes
        </label>
        <div className="relative">
          <MdSearch
            size={19}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="attribute-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search attributes"
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {attributes.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <MdSearch size={24} className="mx-auto text-slate-300" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-600">No matching attributes</p>
            <p className="mt-1 text-xs text-slate-400">Try a different search term.</p>
          </div>
        ) : (
          attributes.map((attr) => {
            const active = attr.id === selectedId;
            const valueCount = (attr.values || []).length;
            return (
              <button
                key={attr.id}
                type="button"
                onClick={() => onSelect(attr.id)}
                aria-current={active ? 'true' : undefined}
                className={`group flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-ring)] ${
                  active ? 'bg-[var(--brand-soft)]' : 'bg-white hover:bg-slate-50'
                }`}
              >
                <span
                  className={`h-10 w-1 shrink-0 rounded-full transition ${active ? 'bg-[var(--brand)]' : 'bg-slate-200 group-hover:bg-slate-300'}`}
                  aria-hidden="true"
                />
                <AttributePreview attr={attr} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-bold ${active ? 'text-slate-950' : 'text-slate-700'}`}>
                    {attr.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {valueCount} value{valueCount === 1 ? '' : 's'} · {(TYPE_META[attr.type] || TYPE_META.text).label}
                  </span>
                </span>
                <MdChevronRight
                  size={20}
                  className={active ? 'text-[var(--brand-strong)]' : 'text-slate-300'}
                  aria-hidden="true"
                />
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function AddValueForm({ attrType, onAdd, onCancel }) {
  const [form, setForm] = useState({ value: '', colorHex: attrType === 'color' ? '#0f172a' : '' });
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.value.trim()) {
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    const ok = await onAdd({ value: form.value.trim(), colorHex: form.colorHex || null });
    setSaving(false);
    if (ok) onCancel();
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-md border border-[var(--brand-ring)] bg-[var(--brand-soft)] p-4">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(180px,1fr)_auto] sm:items-end">
        {attrType === 'color' && (
          <div>
            <label htmlFor="new-value-colour" className="mb-2 block text-xs font-semibold text-slate-700">
              Colour
            </label>
            <input
              id="new-value-colour"
              type="color"
              value={form.colorHex || '#0f172a'}
              onChange={(event) => setForm((current) => ({ ...current, colorHex: event.target.value }))}
              className="h-11 w-14 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
            />
          </div>
        )}
        <div>
          <label htmlFor="new-attribute-value" className="mb-2 block text-xs font-semibold text-slate-700">
            Value name <span className="text-red-600">*</span>
          </label>
          <input
            id="new-attribute-value"
            ref={inputRef}
            value={form.value}
            onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
            placeholder={attrType === 'color' ? 'e.g. Midnight blue' : attrType === 'image' ? 'e.g. Floral print' : 'e.g. Large'}
            className={inputClass}
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost min-h-11">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand min-h-11 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Adding...' : 'Add value'}
          </button>
        </div>
      </div>
    </form>
  );
}

function ValueCard({ value, attrType, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    value: value.value,
    colorHex: value.colorHex || '',
    active: value.active !== false
  });

  const startEditing = () => {
    setDraft({ value: value.value, colorHex: value.colorHex || '', active: value.active !== false });
    setEditing(true);
  };

  const save = async () => {
    if (!draft.value.trim()) return;
    setSaving(true);
    const ok = await onSave({ ...draft, value: draft.value.trim(), colorHex: draft.colorHex || null });
    setSaving(false);
    if (ok !== false) setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] p-3 shadow-sm">
        <div className="flex gap-2">
          {attrType === 'color' && (
            <input
              type="color"
              aria-label={`Colour for ${value.value}`}
              value={draft.colorHex || '#0f172a'}
              onChange={(event) => setDraft((current) => ({ ...current, colorHex: event.target.value }))}
              className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
            />
          )}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Value name</span>
            <input
              autoFocus
              value={draft.value}
              onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') save();
                if (event.key === 'Escape') setEditing(false);
              }}
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Available for products
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
              aria-label={`Cancel editing ${value.value}`}
            >
              <MdClose size={19} />
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex h-11 w-11 items-center justify-center rounded-md bg-[var(--brand)] text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] disabled:opacity-50"
              aria-label={`Save ${value.value}`}
            >
              <MdCheck size={19} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group rounded-md border bg-white p-3 transition hover:border-slate-300 hover:shadow-sm ${value.active === false ? 'border-slate-200 bg-slate-50' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        {attrType === 'color' && (
          <span
            className="h-10 w-10 shrink-0 rounded-md border border-slate-200 shadow-inner"
            style={{ backgroundColor: value.colorHex || '#e2e8f0' }}
            aria-label={value.colorHex ? `Colour ${value.colorHex}` : 'No colour selected'}
          />
        )}
        {attrType !== 'color' && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500" aria-hidden="true">
            {attrType === 'image' ? <MdImage size={19} /> : <MdTextFields size={19} />}
          </span>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-sm font-bold text-slate-800">{value.value}</p>
          <p className={`mt-1 text-xs font-medium ${value.active === false ? 'text-amber-700' : 'text-emerald-700'}`}>
            {value.active === false ? 'Unavailable' : 'Available'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={startEditing}
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            aria-label={`Edit ${value.value}`}
          >
            <MdEdit size={18} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            aria-label={`Delete ${value.value}`}
          >
            <MdDelete size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AttributeWorkspace({ attr, onSave, onDelete, onAddValue, onSaveValue, onDeleteValue }) {
  const [editing, setEditing] = useState(false);
  const [addingValue, setAddingValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: attr.name, type: attr.type });

  const values = useMemo(
    () => [...(attr.values || [])].sort((first, second) => first.value.localeCompare(second.value)),
    [attr.values]
  );
  const activeCount = values.filter((value) => value.active !== false).length;
  const meta = TYPE_META[attr.type] || TYPE_META.text;
  const MetaIcon = meta.icon;

  const saveAttribute = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const ok = await onSave({ ...form, name: form.name.trim() });
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <section className="card-ui min-w-0 overflow-hidden" aria-labelledby="attribute-workspace-title">
      <div className="border-b border-slate-200">
        <div className="h-1 bg-[var(--brand)]" />
        <div className="flex flex-wrap items-start gap-4 px-5 py-5 sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand-strong)]">
            <MetaIcon size={23} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="attribute-workspace-title" className="text-xl font-bold text-slate-950">
                {attr.name}
              </h2>
              <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${meta.badge}`}>
                {meta.label}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500">{meta.description}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing((current) => !current)}
              className="btn-ghost min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            >
              {editing ? <MdClose size={18} /> : <MdEdit size={18} />}
              {editing ? 'Close' : 'Edit details'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <MdDelete size={18} /> Delete
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="border-b border-slate-200 bg-slate-50 p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(360px,1.2fr)_auto] lg:items-end">
            <div>
              <label htmlFor={`attribute-name-${attr.id}`} className="mb-2 block text-xs font-semibold text-slate-700">
                Attribute name
              </label>
              <input
                id={`attribute-name-${attr.id}`}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={inputClass}
              />
            </div>
            <TypePicker value={form.type} onChange={(type) => setForm((current) => ({ ...current, type }))} />
            <button
              type="button"
              onClick={saveAttribute}
              disabled={saving}
              className="btn-brand min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save details'}
            </button>
          </div>
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h3 className="text-base font-bold text-slate-900">Values</h3>
            <p className="mt-1 text-xs text-slate-500">
              {values.length} total · {activeCount} available for product selection
            </p>
          </div>
          {!addingValue && (
            <button type="button" onClick={() => setAddingValue(true)} className="btn-brand min-h-11">
              <MdAdd size={18} /> Add value
            </button>
          )}
        </div>

        {addingValue && (
          <AddValueForm attrType={attr.type} onAdd={onAddValue} onCancel={() => setAddingValue(false)} />
        )}

        {values.length === 0 ? (
          <div className="rounded-md border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <MetaIcon size={30} className="mx-auto text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-slate-700">No values yet</p>
            <p className="mt-1 text-sm text-slate-500">Add the first option customers or staff can select.</p>
            {!addingValue && (
              <button type="button" onClick={() => setAddingValue(true)} className="btn-brand mt-5 min-h-11">
                <MdAdd size={18} /> Add first value
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {values.map((value) => (
              <ValueCard
                key={value.id}
                value={value}
                attrType={attr.type}
                onSave={(draft) => onSaveValue(value.id, draft)}
                onDelete={() => onDeleteValue(value)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function AttributesManager() {
  const [attributes, setAttributes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await getAllAttributesWithValues();
      const next = (response.data || []).slice().sort((first, second) => first.name.localeCompare(second.name));
      setAttributes(next);
      setSelectedId((current) => (next.some((attribute) => attribute.id === current) ? current : next[0]?.id || null));
      return next;
    } catch (error) {
      Swal.fire('Could not load attributes', error?.response?.data?.message || error.message, 'error');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // This is the component's initial data load; later refreshes are triggered by user actions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const filteredAttributes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return attributes;
    return attributes.filter((attribute) =>
      [attribute.name, attribute.type, ...(attribute.values || []).map((value) => value.value)]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [attributes, query]);

  const selectedAttribute = attributes.find((attribute) => attribute.id === selectedId) || null;
  const valueCount = attributes.reduce((total, attribute) => total + (attribute.values || []).length, 0);

  const createAttribute = async (form) => {
    setCreating(true);
    try {
      await createAttributeByAdmin(form);
      const next = await load(true);
      const created = next.find(
        (attribute) => attribute.name.toLowerCase() === form.name.toLowerCase() && attribute.type === form.type
      );
      if (created) setSelectedId(created.id);
      setShowForm(false);
    } catch (error) {
      Swal.fire('Could not create attribute', error?.response?.data?.message || error.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const saveAttribute = async (attr, form) => {
    try {
      await updateAttributeByAdmin({ id: attr.id, ...form });
      await load(true);
      return true;
    } catch (error) {
      Swal.fire('Could not save attribute', error?.response?.data?.message || error.message, 'error');
      return false;
    }
  };

  const deleteAttribute = async (attr) => {
    const confirmed = await confirmDelete({
      subject: attr.name,
      text: 'Every value under it goes too. Products already using those values keep them on record.',
      confirmText: 'Delete attribute'
    });
    if (!confirmed) return;

    try {
      await deleteAttributeByAdmin(attr.id);
      await load(true);
    } catch (error) {
      alertError(error, { title: "Couldn't delete that attribute" });
    }
  };

  const addValue = async (attr, payload) => {
    try {
      await createAttributeValueByAdmin({ attributeId: attr.id, ...payload });
      await load(true);
      return true;
    } catch (error) {
      Swal.fire('Could not add value', error?.response?.data?.message || error.message, 'error');
      return false;
    }
  };

  const saveValue = async (attr, valueId, draft) => {
    try {
      await updateAttributeValueByAdmin({ attributeId: attr.id, valueId, ...draft });
      await load(true);
      return true;
    } catch (error) {
      Swal.fire('Could not save value', error?.response?.data?.message || error.message, 'error');
      return false;
    }
  };

  const deleteValue = async (attr, value) => {
    const result = await Swal.fire({
      title: `Delete "${value.value}"?`,
      text: 'This value will no longer be available on products.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete value',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;

    try {
      await deleteAttributeValueByAdmin({ attributeId: attr.id, valueId: value.id });
      await load(true);
    } catch (error) {
      Swal.fire('Could not delete value', error?.response?.data?.message || error.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product attributes"
        subtitle={loading ? 'Loading attribute catalogue...' : `${attributes.length} attributes · ${valueCount} values`}
        icon={TbAdjustments}
      >
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-brand min-h-11">
            <MdAdd size={18} /> New attribute
          </button>
        )}
      </PageHeader>

      {showForm && (
        <NewAttributeForm onCreate={createAttribute} onCancel={() => setShowForm(false)} saving={creating} />
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
          <div className="card-ui space-y-3 p-4">
            <div className="h-11 animate-pulse rounded-md bg-slate-100" />
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-[72px] animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
          <div className="card-ui space-y-4 p-6">
            <div className="h-14 w-2/3 animate-pulse rounded-md bg-slate-100" />
            <div className="h-11 animate-pulse rounded-md bg-slate-100" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          </div>
        </div>
      ) : attributes.length === 0 ? (
        <div className="card-ui border-2 border-dashed px-6 py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand-strong)]">
            <TbAdjustments size={28} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-base font-bold text-slate-800">Build your attribute catalogue</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Create groups such as Colour, Size or Fabric, then add the values products can use.
          </p>
          {!showForm && (
            <button type="button" onClick={() => setShowForm(true)} className="btn-brand mt-5 min-h-11">
              <MdAdd size={18} /> Create first attribute
            </button>
          )}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
          <AttributeRail
            attributes={filteredAttributes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            query={query}
            onQueryChange={setQuery}
          />
          {selectedAttribute && (
            <AttributeWorkspace
              key={selectedAttribute.id}
              attr={selectedAttribute}
              onSave={(form) => saveAttribute(selectedAttribute, form)}
              onDelete={() => deleteAttribute(selectedAttribute)}
              onAddValue={(payload) => addValue(selectedAttribute, payload)}
              onSaveValue={(valueId, draft) => saveValue(selectedAttribute, valueId, draft)}
              onDeleteValue={(value) => deleteValue(selectedAttribute, value)}
            />
          )}
        </div>
      )}
    </div>
  );
}
