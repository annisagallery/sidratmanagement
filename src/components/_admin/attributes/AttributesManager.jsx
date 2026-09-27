'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { alertError, confirmDelete, toastSuccess } from 'src/utils/swal';
import { MdAdd, MdCheck, MdCheckCircle, MdClose, MdDelete, MdEdit, MdImage, MdPalette, MdSearch, MdTextFields } from 'react-icons/md';
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
import Badge from 'src/components/_admin/ui/Badge';
import Drawer from 'src/components/_admin/ui/Drawer';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { Field, Switch } from 'src/components/_admin/ui/fields';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';

const TYPE_META = {
  text: {
    label: 'Text',
    description: 'Names, sizes, materials and other written options.',
    icon: MdTextFields
  },
  color: {
    label: 'Colour',
    description: 'Colour options, shown to shoppers as a swatch.',
    icon: MdPalette
  },
  image: {
    label: 'Image',
    description: 'Patterns or finishes, shown as a picture.',
    icon: MdImage
  }
};

const typeOf = (attr) => TYPE_META[attr?.type] || TYPE_META.text;

/** How the values are shown to shoppers — one choice of three. */
function TypePicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Shown as" className="grid gap-2 sm:grid-cols-3">
      {Object.entries(TYPE_META).map(([key, meta]) => {
        const Icon = meta.icon;
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(key)}
            className={`rounded-lg border p-3 text-left transition ${
              selected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={18} className="text-slate-500" aria-hidden />
              <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
              {selected && <MdCheckCircle size={16} className="ml-auto text-slate-900" aria-hidden />}
            </span>
            <span className="mt-1 block text-xs leading-snug text-slate-500">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Create a new attribute, or rename / retype an existing one. */
function AttributeDrawer({ attr, onSubmit, onClose }) {
  const editing = Boolean(attr);
  const [form, setForm] = useState({ name: attr?.name || '', type: attr?.type || 'text' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const valueCount = (attr?.values || []).length;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Give the attribute a name.');
      return;
    }
    setSaving(true);
    const ok = await onSubmit({ ...form, name: form.name.trim() });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Drawer
      title={editing ? `Edit ${attr.name}` : 'New attribute'}
      eyebrow="Attributes"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-brand" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create attribute'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <Field label="Name" required error={error} help="The group shoppers choose within, such as Size or Fabric.">
          <input
            value={form.name}
            onChange={(event) => {
              setForm((current) => ({ ...current, name: event.target.value }));
              setError('');
            }}
            placeholder="e.g. Size"
            className="input-ui"
            autoFocus
          />
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-800">Shown as</p>
          <TypePicker value={form.type} onChange={(type) => setForm((current) => ({ ...current, type }))} />
          {editing && form.type !== attr.type && valueCount > 0 && (
            <p className="mt-2 text-[13px] text-amber-800">
              The {valueCount} existing value{valueCount === 1 ? '' : 's'} will be shown the new way.
              {form.type === 'color' ? ' Give each one a colour afterwards.' : ''}
            </p>
          )}
        </div>
        {!editing && <p className="text-[13px] text-slate-500">You add the individual values once the attribute is created.</p>}
      </div>
    </Drawer>
  );
}

function AttributeSwatch({ attr }) {
  const values = (attr.values || []).filter((value) => value.active !== false);
  if (attr.type === 'color' && values.some((value) => value.colorHex)) {
    return (
      <span className="flex w-10 shrink-0 -space-x-1.5" aria-hidden>
        {values.slice(0, 3).map((value) => (
          <span key={value.id} className="h-5 w-5 rounded-full ring-2 ring-white" style={{ backgroundColor: value.colorHex || '#e2e8f0' }} />
        ))}
      </span>
    );
  }
  const Icon = typeOf(attr).icon;
  return (
    <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500" aria-hidden>
      <Icon size={17} />
    </span>
  );
}

function AttributeRail({ attributes, total, selectedId, onSelect, query, onQueryChange }) {
  return (
    <aside className="card-ui overflow-hidden lg:sticky lg:top-0" aria-label="Attributes">
      <div className="border-b border-slate-200 p-3">
        <div className="relative">
          <MdSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search attributes or values"
            aria-label="Search attributes or values"
            className="input-ui pl-9"
          />
        </div>
        {query && (
          <p className="mt-2 px-1 text-xs text-slate-500" role="status">
            {attributes.length} of {total} match
          </p>
        )}
      </div>

      {attributes.length === 0 ? (
        <EmptyState compact icon={MdSearch} title="Nothing matches" hint="Try another name or value." />
      ) : (
        <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
          {attributes.map((attr) => {
            const active = attr.id === selectedId;
            const count = (attr.values || []).length;
            return (
              <li key={attr.id}>
                <button
                  type="button"
                  onClick={() => onSelect(attr.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition ${active ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                >
                  {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-slate-900" aria-hidden />}
                  <AttributeSwatch attr={attr} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${active ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>{attr.name}</span>
                    <span className="block text-xs text-slate-500">
                      {count} value{count === 1 ? '' : 's'} · {typeOf(attr).label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function AddValueForm({ attrType, onAdd, onCancel }) {
  const [form, setForm] = useState({ value: '', colorHex: attrType === 'color' ? '#0f172a' : '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.value.trim()) {
      setError('Enter the value name.');
      return;
    }
    setSaving(true);
    const ok = await onAdd({ value: form.value.trim(), colorHex: form.colorHex || null });
    setSaving(false);
    // Stay open for the next one: values are usually added several at a time.
    if (ok) setForm((current) => ({ ...current, value: '' }));
  };

  return (
    <form onSubmit={submit} noValidate className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start gap-3">
        {attrType === 'color' && (
          <Field label="Colour">
            <input
              type="color"
              value={form.colorHex || '#0f172a'}
              onChange={(event) => setForm((current) => ({ ...current, colorHex: event.target.value }))}
              className="h-10 w-14 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
            />
          </Field>
        )}
        <Field label="New value" required error={error} className="min-w-[200px] flex-1">
          <input
            value={form.value}
            onChange={(event) => {
              setForm((current) => ({ ...current, value: event.target.value }));
              setError('');
            }}
            placeholder={attrType === 'color' ? 'e.g. Midnight blue' : attrType === 'image' ? 'e.g. Floral print' : 'e.g. Large'}
            className="input-ui"
            autoFocus
          />
        </Field>
        <div className="flex gap-2 sm:pt-[26px]">
          <button type="button" onClick={onCancel} className="btn-ghost" disabled={saving}>
            Done
          </button>
          <button type="submit" disabled={saving} className="btn-brand">
            {saving ? 'Adding…' : 'Add value'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Press Enter to add, then type the next one.</p>
    </form>
  );
}

function ValueRow({ value, attrType, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ value: value.value, colorHex: value.colorHex || '' });
  const available = value.active !== false;

  const startEditing = () => {
    setDraft({ value: value.value, colorHex: value.colorHex || '' });
    setEditing(true);
  };

  const save = async () => {
    if (!draft.value.trim()) return;
    setSaving(true);
    const ok = await onSave({ ...draft, active: available, value: draft.value.trim(), colorHex: draft.colorHex || null });
    setSaving(false);
    if (ok !== false) setEditing(false);
  };

  const toggleAvailable = (on) =>
    onSave({ value: value.value, colorHex: value.colorHex || null, active: on }, on ? `“${value.value}” is available` : `“${value.value}” is hidden`);

  return (
    <li className={`flex min-h-[60px] items-center gap-3 px-4 py-2.5 ${available ? '' : 'bg-slate-50'}`}>
      {attrType === 'color' ? (
        editing ? (
          <input
            type="color"
            aria-label={`Colour for ${value.value}`}
            value={draft.colorHex || '#0f172a'}
            onChange={(event) => setDraft((current) => ({ ...current, colorHex: event.target.value }))}
            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
          />
        ) : (
          <span
            className="h-8 w-8 shrink-0 rounded-md ring-1 ring-inset ring-slate-900/10"
            style={{ backgroundColor: value.colorHex || '#e2e8f0' }}
            aria-hidden
          />
        )
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500" aria-hidden>
          {attrType === 'image' ? <MdImage size={17} /> : <MdTextFields size={17} />}
        </span>
      )}

      {editing ? (
        <input
          autoFocus
          value={draft.value}
          aria-label="Value name"
          onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save();
            if (event.key === 'Escape') setEditing(false);
          }}
          className="input-ui min-w-0 flex-1"
        />
      ) : (
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${available ? 'text-slate-900' : 'text-slate-500'}`}>{value.value}</p>
          {attrType === 'color' && value.colorHex && <p className="ops-code text-xs uppercase text-slate-500">{value.colorHex}</p>}
        </div>
      )}

      {editing ? (
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => setEditing(false)} className="btn-icon" aria-label={`Cancel editing ${value.value}`} title="Cancel">
            <MdClose size={18} aria-hidden />
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-brand btn-sm" aria-label={`Save ${value.value}`}>
            <MdCheck size={17} aria-hidden /> Save
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[13px] text-slate-600 sm:inline">{available ? 'Available' : 'Hidden'}</span>
          <Switch checked={available} onChange={toggleAvailable} label={`${value.value} is available for products`} />
          <ActionMenu
            label={`More actions for ${value.value}`}
            items={[
              { label: 'Rename', icon: MdEdit, onClick: startEditing },
              { label: 'Delete', icon: MdDelete, tone: 'danger', onClick: onDelete }
            ]}
          />
        </div>
      )}
    </li>
  );
}

function AttributeWorkspace({ attr, onEdit, onDelete, onAddValue, onSaveValue, onDeleteValue }) {
  const [addingValue, setAddingValue] = useState(false);

  const values = useMemo(() => [...(attr.values || [])].sort((first, second) => first.value.localeCompare(second.value)), [attr.values]);
  const activeCount = values.filter((value) => value.active !== false).length;
  const meta = typeOf(attr);
  const MetaIcon = meta.icon;

  return (
    <section className="card-ui min-w-0 overflow-hidden" aria-labelledby="attribute-workspace-title">
      <header className="flex flex-wrap items-start gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="attribute-workspace-title" className="text-lg font-semibold text-slate-900">
              {attr.name}
            </h2>
            <Badge>
              <MetaIcon size={13} aria-hidden /> {meta.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {values.length} value{values.length === 1 ? '' : 's'} · {activeCount} available on products
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!addingValue && (
            <button type="button" onClick={() => setAddingValue(true)} className="btn-brand">
              <MdAdd size={18} aria-hidden /> Add values
            </button>
          )}
          <ActionMenu
            label={`More actions for ${attr.name}`}
            items={[
              { label: 'Edit name and type', icon: MdEdit, onClick: onEdit },
              { label: 'Delete attribute', icon: MdDelete, tone: 'danger', onClick: onDelete }
            ]}
          />
        </div>
      </header>

      <div className="p-5">
        {addingValue && <AddValueForm attrType={attr.type} onAdd={onAddValue} onCancel={() => setAddingValue(false)} />}

        {values.length === 0 ? (
          !addingValue && (
            <EmptyState
              compact
              icon={MetaIcon}
              title="No values yet"
              hint="Add the options products can be made in."
              action={
                <button type="button" onClick={() => setAddingValue(true)} className="btn-brand">
                  <MdAdd size={18} aria-hidden /> Add the first value
                </button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
            {values.map((value) => (
              <ValueRow
                key={value.id}
                value={value}
                attrType={attr.type}
                onSave={(draft, message) => onSaveValue(value.id, draft, message)}
                onDelete={() => onDeleteValue(value)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function AttributesManager({ startCreating = false }) {
  const [attributes, setAttributes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [drawer, setDrawer] = useState(startCreating ? { mode: 'create' } : null);
  const firstLoad = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await getAllAttributesWithValues();
      const next = (response.data || []).slice().sort((first, second) => first.name.localeCompare(second.name));
      setAttributes(next);
      setLoadError(null);
      setSelectedId((current) => (next.some((attribute) => attribute.id === current) ? current : next[0]?.id || null));
      return next;
    } catch (error) {
      // A failed first load is a page state, not an empty catalogue; a failed
      // refresh after a change keeps what is on screen and says so.
      if (firstLoad.current) setLoadError(error);
      else alertError(error, { title: 'The list could not be refreshed' });
      return null;
    } finally {
      firstLoad.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // This is the component's initial data load; later refreshes are triggered by user actions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filteredAttributes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return attributes;
    return attributes.filter((attribute) =>
      [attribute.name, attribute.type, ...(attribute.values || []).map((value) => value.value)].join(' ').toLowerCase().includes(term)
    );
  }, [attributes, query]);

  const selectedAttribute = attributes.find((attribute) => attribute.id === selectedId) || null;
  const valueCount = attributes.reduce((total, attribute) => total + (attribute.values || []).length, 0);

  const createAttribute = async (form) => {
    try {
      await createAttributeByAdmin(form);
      const next = await load(true);
      const created = next?.find((attribute) => attribute.name.toLowerCase() === form.name.toLowerCase() && attribute.type === form.type);
      if (created) setSelectedId(created.id);
      toastSuccess(`“${form.name}” created`, 'Now add its values.');
      return true;
    } catch (error) {
      alertError(error, { title: 'The attribute was not created' });
      return false;
    }
  };

  const saveAttribute = async (attr, form) => {
    try {
      await updateAttributeByAdmin({ id: attr.id, ...form });
      await load(true);
      toastSuccess('Attribute saved');
      return true;
    } catch (error) {
      alertError(error, { title: 'The attribute was not saved' });
      return false;
    }
  };

  const deleteAttribute = async (attr) => {
    const count = (attr.values || []).length;
    const confirmed = await confirmDelete({
      title: 'Delete this attribute?',
      subject: attr.name,
      text: `${count ? `Its ${count} value${count === 1 ? '' : 's'} go too. ` : ''}Products already using them keep them on record.`,
      confirmText: 'Delete attribute'
    });
    if (!confirmed) return;

    try {
      await deleteAttributeByAdmin(attr.id);
      await load(true);
      toastSuccess(`“${attr.name}” deleted`);
    } catch (error) {
      alertError(error, { title: 'The attribute was not deleted' });
    }
  };

  const addValue = async (attr, payload) => {
    try {
      await createAttributeValueByAdmin({ attributeId: attr.id, ...payload });
      await load(true);
      toastSuccess(`Added “${payload.value}”`);
      return true;
    } catch (error) {
      alertError(error, { title: 'The value was not added' });
      return false;
    }
  };

  const saveValue = async (attr, valueId, draft, message = 'Value saved') => {
    try {
      await updateAttributeValueByAdmin({ attributeId: attr.id, valueId, ...draft });
      await load(true);
      toastSuccess(message);
      return true;
    } catch (error) {
      alertError(error, { title: 'The value was not saved' });
      return false;
    }
  };

  const deleteValue = async (attr, value) => {
    const confirmed = await confirmDelete({
      title: 'Delete this value?',
      subject: value.value,
      text: 'It can no longer be chosen on products. To keep it on record instead, switch it off.',
      confirmText: 'Delete value'
    });
    if (!confirmed) return;

    try {
      await deleteAttributeValueByAdmin({ attributeId: attr.id, valueId: value.id });
      await load(true);
      toastSuccess(`Deleted “${value.value}”`);
    } catch (error) {
      alertError(error, { title: 'The value was not deleted' });
    }
  };

  const newButton = (
    <button type="button" onClick={() => setDrawer({ mode: 'create' })} className="btn-brand">
      <MdAdd size={18} aria-hidden /> New attribute
    </button>
  );

  let body;
  if (loading) {
    body = (
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]" aria-busy="true">
        <div className="card-ui space-y-3 p-4">
          <div className="skeleton h-10 w-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton h-12 w-full" />
          ))}
        </div>
        <div className="card-ui space-y-4 p-5">
          <div className="skeleton h-7 w-1/3" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton h-12 w-full" />
          ))}
        </div>
      </div>
    );
  } else if (loadError) {
    body = (
      <ErrorState
        error={loadError}
        title="Attributes could not be loaded"
        onRetry={() => {
          firstLoad.current = true;
          load();
        }}
      />
    );
  } else if (attributes.length === 0) {
    body = (
      <div className="card-ui">
        <EmptyState
          icon={TbAdjustments}
          title="No attributes yet"
          hint="Create groups such as Colour, Size or Fabric, then add the values products can be made in."
          action={newButton}
        />
      </div>
    );
  } else {
    body = (
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <AttributeRail
          attributes={filteredAttributes}
          total={attributes.length}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          onQueryChange={setQuery}
        />
        {selectedAttribute && (
          <AttributeWorkspace
            key={selectedAttribute.id}
            attr={selectedAttribute}
            onEdit={() => setDrawer({ mode: 'edit', attr: selectedAttribute })}
            onDelete={() => deleteAttribute(selectedAttribute)}
            onAddValue={(payload) => addValue(selectedAttribute, payload)}
            onSaveValue={(valueId, draft, message) => saveValue(selectedAttribute, valueId, draft, message)}
            onDeleteValue={(value) => deleteValue(selectedAttribute, value)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attributes"
        subtitle={loading || loadError ? undefined : `${attributes.length} attributes · ${valueCount} values`}
      >
        {newButton}
      </PageHeader>

      {body}

      {drawer && (
        <AttributeDrawer
          attr={drawer.mode === 'edit' ? drawer.attr : null}
          onSubmit={(form) => (drawer.mode === 'edit' ? saveAttribute(drawer.attr, form) : createAttribute(form))}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
