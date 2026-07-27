'use client';
import DataTable from 'src/components/_admin/ui/DataTable';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import {
  createInventoryLimitByAdmin,
  deleteInventoryLimitByAdmin,
  getAllAttributesWithValues,
  getInventoryLimitsByAdmin,
  updateInventoryLimitByAdmin
} from 'src/services';
import { MdAdd, MdClose, MdDelete, MdEdit } from 'react-icons/md';

const emptyForm = {
  attributes: [],
  quantity: 0
};

function attrLabel(attr) {
  return `${attr.attributeName}: ${attr.valueName}`;
}

function groupName(attributes = []) {
  return attributes.map(attrLabel).join(' + ') || 'Attribute group';
}

export default function InventoryLimitsManager() {
  const [limits, setLimits] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAttrId, setSelectedAttrId] = useState('');
  const [selectedValueId, setSelectedValueId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [limitRes, attrRes] = await Promise.all([getInventoryLimitsByAdmin(), getAllAttributesWithValues()]);
      setLimits(limitRes.data || []);
      setAttributes(attrRes.data || []);
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedAttr = useMemo(
    () => attributes.find((a) => a.id === selectedAttrId) || null,
    [attributes, selectedAttrId]
  );
  const selectedValue = useMemo(
    () => (selectedAttr?.values || []).find((v) => v.id === selectedValueId) || null,
    [selectedAttr, selectedValueId]
  );

  const reset = () => {
    setForm(emptyForm);
    setEditing(null);
    setSelectedAttrId('');
    setSelectedValueId('');
  };

  const addAttributeValue = () => {
    if (!selectedAttr || !selectedValue) return;
    setForm((prev) => ({
      ...prev,
      attributes: [
        ...prev.attributes.filter((attr) => attr.attribute !== selectedAttr.id),
        {
          attribute: selectedAttr.id,
          attributeName: selectedAttr.name,
          value: selectedValue.id,
          valueName: selectedValue.value,
          colorHex: selectedValue.colorHex || null
        }
      ]
    }));
    setSelectedAttrId('');
    setSelectedValueId('');
  };

  const removeAttributeValue = (attributeId) => {
    setForm((prev) => ({ ...prev, attributes: prev.attributes.filter((attr) => attr.attribute !== attributeId) }));
  };

  const startEdit = (limit) => {
    setEditing(limit);
    setForm({
      attributes: limit.attributes || [],
      quantity: limit.quantity || 0
    });
    setSelectedAttrId('');
    setSelectedValueId('');
  };

  const save = async () => {
    if (!form.attributes.length) return Swal.fire('Validation', 'Add at least one attribute value.', 'warning');
    setSaving(true);
    try {
      const payload = { attributes: form.attributes, quantity: Number(form.quantity || 0) };
      if (editing) await updateInventoryLimitByAdmin({ id: editing.id, ...payload });
      else await createInventoryLimitByAdmin(payload);
      reset();
      await load();
      Swal.fire({ title: 'Saved', icon: 'success', timer: 1000, showConfirmButton: false });
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (limit) => {
    const r = await Swal.fire({
      title: 'Delete inventory limit?',
      text: groupName(limit.attributes),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete'
    });
    if (!r.isConfirmed) return;
    await deleteInventoryLimitByAdmin(limit.id);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Attribute Inventory Limits</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Create shared presale quantities for one attribute value, or a group of attribute values.
          </p>
        </div>
        <Link
          href="/attributes"
          className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Back to Attributes
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-md border bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {editing ? 'Edit attribute group' : 'New attribute group'}
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Presale number
              </label>
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>

            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Attribute group</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  value={selectedAttrId}
                  onChange={(e) => {
                    setSelectedAttrId(e.target.value);
                    setSelectedValueId('');
                  }}
                  className="rounded-md border px-2 py-2 text-sm"
                >
                  <option value="">Attribute</option>
                  {attributes.map((attr) => (
                    <option key={attr.id} value={attr.id}>
                      {attr.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedValueId}
                  onChange={(e) => setSelectedValueId(e.target.value)}
                  className="rounded-md border px-2 py-2 text-sm"
                  disabled={!selectedAttr}
                >
                  <option value="">Value</option>
                  {(selectedAttr?.values || []).map((val) => (
                    <option key={val.id} value={val.id}>
                      {val.value}
                      {val.active === false ? ' (disabled)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addAttributeValue}
                  className="inline-flex items-center justify-center rounded-md bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:brightness-95"
                >
                  <MdAdd />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Adding another value for the same attribute replaces the old one.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {form.attributes.map((attr) => (
                  <span
                    key={`${attr.attribute}-${attr.value}`}
                    className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-700"
                  >
                    {attr.colorHex && (
                      <span className="h-3 w-3 rounded-md border" style={{ backgroundColor: attr.colorHex }} />
                    )}
                    {attrLabel(attr)}
                    <button
                      type="button"
                      onClick={() => removeAttributeValue(attr.attribute)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <MdClose />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t pt-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-md bg-[var(--brand)] py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Update limit' : 'Create limit'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-md border bg-white">
            <DataTable className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Attribute Group</th>
                  <th className="px-4 py-3 text-right">Presale Number</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : limits.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                      No inventory limits yet.
                    </td>
                  </tr>
                ) : (
                  limits.map((limit) => (
                    <tr key={limit.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(limit.attributes || []).map((attr) => (
                            <span
                              key={`${limit.id}-${attr.value}`}
                              className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600"
                            >
                              {attrLabel(attr)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{limit.quantity || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(limit)}
                          className="mr-2 rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <MdEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(limit)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <MdDelete />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </DataTable>
          </div>
        </div>
      </div>
    </div>
  );
}
