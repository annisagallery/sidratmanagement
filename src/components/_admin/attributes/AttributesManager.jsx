'use client';
import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import {
  getAllAttributesWithValues,
  createAttributeByAdmin,
  updateAttributeByAdmin,
  deleteAttributeByAdmin,
  createAttributeValueByAdmin,
  updateAttributeValueByAdmin,
  deleteAttributeValueByAdmin
} from 'src/services';
import { MdAdd, MdEdit, MdDelete, MdCheck, MdClose } from 'react-icons/md';
import { TbAdjustments } from 'react-icons/tb';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import DataTable from 'src/components/_admin/ui/DataTable';

const TYPE_META = {
  text: { label: 'Text', cls: 'bg-gray-100 text-gray-600' },
  color: { label: 'Color', cls: 'bg-pink-50 text-pink-700' },
  image: { label: 'Image', cls: 'bg-blue-50 text-blue-700' }
};

function TypePicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {Object.entries(TYPE_META).map(([k, v]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
            value === k
              ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]'
              : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

// ── Value chip: read-only with Edit button; pencil switches to inline editor ──
function ValueChip({ val, attrType, onDelete, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ value: val.value, colorHex: val.colorHex || '', active: val.active !== false });
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  const startEdit = () => {
    setDraft({ value: val.value, colorHex: val.colorHex || '', active: val.active !== false });
    setEditing(true);
  };
  const cancel = () => setEditing(false);

  const save = async () => {
    if (!draft.value.trim()) return;
    setSaving(true);
    await onSave({ value: draft.value, colorHex: draft.colorHex || null, active: draft.active });
    setSaving(false);
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-[var(--brand-ring)] bg-[var(--brand-soft)]/40 px-2 py-1">
        {attrType === 'color' && (
          <input
            type="color"
            value={draft.colorHex || '#000000'}
            onChange={(e) => setDraft((p) => ({ ...p, colorHex: e.target.value }))}
            className="w-6 h-6 rounded-md border-0 cursor-pointer p-0 flex-shrink-0"
            title="Pick color"
          />
        )}
        <input
          ref={inputRef}
          value={draft.value}
          onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
          className="w-24 bg-transparent text-sm text-gray-800 outline-none"
          placeholder="Value"
        />
        <label className="flex items-center gap-1 text-[11px] text-gray-500" title="Inactive values are hidden from new products">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))}
            className="accent-[var(--brand)]"
          />
          Active
        </label>
        <button
          onClick={save}
          disabled={saving}
          className="p-1 text-green-600 hover:bg-green-50 rounded-md transition disabled:opacity-50"
          title="Save"
        >
          <MdCheck size={14} />
        </button>
        <button onClick={cancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition" title="Cancel">
          <MdClose size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1 shadow-sm transition hover:border-gray-300 ${
        val.active === false ? 'opacity-60 border-gray-200' : 'border-gray-200'
      }`}
    >
      {attrType === 'color' && val.colorHex && (
        <span
          className="w-3.5 h-3.5 rounded-md border border-gray-200 flex-shrink-0"
          style={{ backgroundColor: val.colorHex }}
        />
      )}
      <span className="text-sm text-gray-700">{val.value}</span>
      {val.active === false && <span className="text-[10px] font-semibold text-gray-400">off</span>}
      <button
        onClick={startEdit}
        className="text-gray-300 group-hover:text-[var(--brand-strong)] transition flex-shrink-0"
        title={`Edit ${val.value}`}
      >
        <MdEdit size={13} />
      </button>
      <button
        onClick={onDelete}
        className="text-gray-300 group-hover:text-red-400 hover:text-red-600 transition flex-shrink-0"
        title={`Delete ${val.value}`}
      >
        <MdClose size={13} />
      </button>
    </div>
  );
}

// ── "+ Add" chip: expands into a small inline form ────────────────────────────
function AddValueChip({ attrType, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ value: '', colorHex: '' });
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const add = async () => {
    if (!form.value.trim()) {
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    const ok = await onAdd({ value: form.value, colorHex: form.colorHex || null });
    setSaving(false);
    if (ok) {
      setForm((p) => ({ value: '', colorHex: p.colorHex }));
      inputRef.current?.focus();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2.5 py-1 text-sm text-gray-400 transition hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
      >
        <MdAdd size={14} /> Add
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-[var(--brand-ring)] bg-[var(--brand-soft)]/40 px-2 py-1">
      {attrType === 'color' && (
        <input
          type="color"
          value={form.colorHex || '#000000'}
          onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))}
          className="w-6 h-6 rounded-md border-0 cursor-pointer p-0 flex-shrink-0"
          title="Pick color"
        />
      )}
      <input
        ref={inputRef}
        value={form.value}
        onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={attrType === 'color' ? 'e.g. Black' : attrType === 'image' ? 'e.g. Pattern A' : 'e.g. Small'}
        className="w-24 bg-transparent text-sm text-gray-800 outline-none"
      />
      <button
        onClick={add}
        disabled={saving}
        className="p-1 text-green-600 hover:bg-green-50 rounded-md transition disabled:opacity-50"
        title="Add value (Enter)"
      >
        <MdCheck size={14} />
      </button>
      <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition" title="Close">
        <MdClose size={14} />
      </button>
    </div>
  );
}

// ── New attribute form panel (shown from the header button) ───────────────────
function NewAttributeForm({ onCreate, onCancel, saving }) {
  const [form, setForm] = useState({ name: '', type: 'text' });
  const inputRef = useRef();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      inputRef.current?.focus();
      return;
    }
    onCreate(form);
  };

  return (
    <form onSubmit={submit} className="space-y-3 bg-gray-50 border border-gray-200 rounded-md p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Attribute name *</label>
          <input
            ref={inputRef}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Color, Size, Fabric"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <TypePicker value={form.type} onChange={(type) => setForm((p) => ({ ...p, type }))} />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-brand">
            {saving ? 'Creating…' : 'Create Attribute'}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">You can add its values right in the list below after creating.</p>
    </form>
  );
}

// ── One attribute row: read-only until Edit is clicked ────────────────────────
function AttributeRow({ attr, onSave, onDelete, onAddVal, onSaveVal, onDeleteVal }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: attr.name, type: attr.type });
  const [saving, setSaving] = useState(false);

  const sortedValues = [...(attr.values || [])].sort((a, b) => a.value.localeCompare(b.value));
  const meta = TYPE_META[attr.type] || TYPE_META.text;

  const startEdit = () => {
    setForm({ name: attr.name, type: attr.type });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-[var(--brand-soft)]/30 border-b border-[var(--brand-ring)]">
        <td className="px-4 py-2.5">
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="border rounded-md px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--brand-ring)]"
            placeholder="Attribute name"
          />
        </td>
        <td className="px-4 py-2.5">
          <TypePicker value={form.type} onChange={(type) => setForm((p) => ({ ...p, type }))} />
        </td>
        <td className="px-4 py-2.5 text-sm text-gray-400">{sortedValues.length} value{sortedValues.length !== 1 ? 's' : ''}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center justify-end gap-1">
            <button onClick={save} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition disabled:opacity-50" title="Save">
              <MdCheck size={15} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition" title="Cancel">
              <MdClose size={15} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 align-top">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm font-semibold text-gray-800">{attr.name}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {sortedValues.map((val) => (
            <ValueChip
              key={val._id}
              val={val}
              attrType={attr.type}
              onDelete={() => onDeleteVal(val)}
              onSave={(draft) => onSaveVal(val._id, draft)}
            />
          ))}
          <AddValueChip attrType={attr.type} onAdd={onAddVal} />
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={startEdit}
            className="px-2 py-1 text-xs text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] rounded-md transition"
            title={`Edit ${attr.name}`}
          >
            <MdEdit size={13} className="inline -mt-0.5 mr-0.5" /> Edit
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition"
            title={`Delete ${attr.name}`}
          >
            <MdDelete size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AttributesManager() {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getAllAttributesWithValues();
      setAttributes((res.data || []).slice().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ── Attribute CRUD ──────────────────────────────────────────────────────────
  const createAttr = async (form) => {
    setCreating(true);
    try {
      await createAttributeByAdmin(form);
      setShowForm(false);
      await load(true);
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const saveAttr = async (attr, form) => {
    try {
      await updateAttributeByAdmin({ id: attr._id, ...form });
      await load(true);
      return true;
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || e.message, 'error');
      return false;
    }
  };

  const delAttr = async (attr) => {
    const r = await Swal.fire({
      title: `Delete "${attr.name}"?`,
      text: 'All its values will also be removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete'
    });
    if (!r.isConfirmed) return;
    try {
      await deleteAttributeByAdmin(attr._id);
      await load(true);
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || e.message, 'error');
    }
  };

  // ── Value CRUD ──────────────────────────────────────────────────────────────
  const addVal = async (attr, payload) => {
    try {
      await createAttributeValueByAdmin({ attributeId: attr._id, ...payload });
      await load(true);
      return true;
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || e.message, 'error');
      return false;
    }
  };

  const saveVal = async (attr, valueId, draft) => {
    try {
      await updateAttributeValueByAdmin({ attributeId: attr._id, valueId, ...draft });
      await load(true);
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || e.message, 'error');
    }
  };

  const delVal = async (attr, val) => {
    const r = await Swal.fire({
      title: `Delete "${val.value}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete'
    });
    if (!r.isConfirmed) return;
    try {
      await deleteAttributeValueByAdmin({ attributeId: attr._id, valueId: val._id });
      await load(true);
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || e.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attributes"
        subtitle="Product attributes (Color, Size, etc.) and their values — sorted A–Z"
        icon={TbAdjustments}
      >
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-brand">
            <MdAdd size={16} /> New Attribute
          </button>
        )}
      </PageHeader>

      {showForm && <NewAttributeForm onCreate={createAttr} onCancel={() => setShowForm(false)} saving={creating} />}

      {loading ? (
        <div className="card-ui p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      ) : attributes.length === 0 ? (
        <div className="text-center py-14 text-sm text-gray-500 border border-dashed border-gray-300 rounded-md">
          <TbAdjustments size={36} className="mx-auto mb-3 opacity-20" />
          No attributes yet — create your first one above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <DataTable className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Attribute</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 uppercase tracking-wide w-full">Values</th>
                <th className="px-4 py-2.5 text-right text-xs text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((attr) => (
                <AttributeRow
                  key={attr._id}
                  attr={attr}
                  onSave={(form) => saveAttr(attr, form)}
                  onDelete={() => delAttr(attr)}
                  onAddVal={(payload) => addVal(attr, payload)}
                  onSaveVal={(valueId, draft) => saveVal(attr, valueId, draft)}
                  onDeleteVal={(val) => delVal(attr, val)}
                />
              ))}
            </tbody>
          </DataTable>
        </div>
      )}
    </div>
  );
}
