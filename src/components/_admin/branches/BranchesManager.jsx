'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { FiEdit2, FiTrash2, FiPlus, FiX, FiCheck, FiMapPin, FiHome } from 'react-icons/fi';
import { adminGetBranches, adminCreateBranch, adminUpdateBranch, adminDeleteBranch } from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const EMPTY = {
  name: '',
  code: '',
  city: '',
  address: '',
  phone: '',
  offDay: '',
  mapLink: '',
  bin: '',
  vatPercent: null,
  receiptNote: '',
  isActive: true,
  order: 0
};

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function BranchForm({ initial = EMPTY, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.checked }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          bin: (form.bin || '').trim(),
          vatPercent: form.vatPercent === '' || form.vatPercent == null ? null : Number(form.vatPercent)
        });
      }}
      className="card-ui space-y-4 p-5"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Branch Name *">
          <input
            className="input-ui"
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Bashundhara Branch"
            required
          />
        </Field>
        <Field label="Code *">
          <input
            className="input-ui uppercase"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            placeholder="e.g. BSD"
            required
          />
        </Field>
        <Field label="City *">
          <input className="input-ui" value={form.city} onChange={set('city')} placeholder="e.g. Dhaka" required />
        </Field>
        <Field label="Address *">
          <input
            className="input-ui"
            value={form.address}
            onChange={set('address')}
            placeholder="Full address"
            required
          />
        </Field>
        <Field label="Phone">
          <input className="input-ui" value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
        </Field>
        <Field label="Off Day">
          <select className="select-ui w-full" value={form.offDay} onChange={set('offDay')}>
            <option value="">— None —</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Google Maps Link">
          <input
            className="input-ui"
            value={form.mapLink}
            onChange={set('mapLink')}
            placeholder="https://maps.google.com/..."
          />
        </Field>
        <Field label="BIN (VAT registration no.)">
          <input
            className="input-ui"
            value={form.bin || ''}
            onChange={set('bin')}
            placeholder="Printed on POS receipts"
          />
        </Field>
        <Field label="VAT % (override)">
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="input-ui"
            value={form.vatPercent ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, vatPercent: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) }))
            }
            placeholder="Blank = global POS rate"
          />
        </Field>
        <Field label="Receipt note (override)">
          <input
            className="input-ui"
            maxLength={500}
            value={form.receiptNote || ''}
            onChange={set('receiptNote')}
            placeholder="Blank = global receipt note"
          />
        </Field>
        <Field label="Sort Order">
          <input type="number" className="input-ui" value={form.order} onChange={set('order')} min={0} />
        </Field>
        <Field label="Options">
          <div className="mt-2 space-y-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={setCheck('isActive')}
                className="h-4 w-4"
                style={{ accentColor: 'var(--brand)' }}
              />
              <span className="text-sm text-slate-600">Active (visible on storefront)</span>
            </label>
          </div>
        </Field>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="btn-brand">
          <FiCheck /> {saving ? 'Saving…' : 'Save Branch'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          <FiX /> Cancel
        </button>
      </div>
    </form>
  );
}

export default function BranchesManager() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editHq, setEditHq] = useState(false);
  const [hqForm, setHqForm] = useState({ address: '' });

  const { data, isLoading } = useQuery('admin-branches', adminGetBranches);
  const all = data?.data ?? [];
  const hq = all.find((b) => b.type === 'HQ' || b.code === 'HQ');
  const branches = all.filter((b) => b.type !== 'HQ' && b.code !== 'HQ');

  // Group by city for display (HQ excluded — it is a system location, not a branch)
  const grouped = branches.reduce((acc, b) => {
    (acc[b.city] = acc[b.city] || []).push(b);
    return acc;
  }, {});

  const invalidate = () => qc.invalidateQueries('admin-branches');

  const createMut = useMutation(adminCreateBranch, {
    onSuccess: () => {
      toast.success('Branch created');
      setAdding(false);
      invalidate();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error')
  });

  const updateMut = useMutation(adminUpdateBranch, {
    onSuccess: () => {
      toast.success('Branch updated');
      setEditId(null);
      setEditHq(false);
      invalidate();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error')
  });

  const deleteMut = useMutation(adminDeleteBranch, {
    onSuccess: () => {
      toast.success('Branch archived');
      invalidate();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Error')
  });

  const handleDelete = (id, name) => {
    if (confirm(`Archive "${name}"? Its saved data is kept but it is removed from the storefront.`))
      deleteMut.mutate(id);
  };
  const toggleActive = (b) => updateMut.mutate({ id: b.id, isActive: !b.isActive });

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title="Branches"
        subtitle={`${branches.length} branch${branches.length !== 1 ? 'es' : ''} · grouped by city on the storefront (HQ not counted)`}
      >
        {!adding && (
          <button
            onClick={() => {
              setAdding(true);
              setEditId(null);
            }}
            className="btn-brand"
          >
            <FiPlus /> Add Branch
          </button>
        )}
      </PageHeader>

      {/* HQ — system location (not a branch, never on storefront) */}
      {hq && (
        <section className="card-ui overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <FiHome style={{ color: 'var(--brand-strong)' }} />
            <h2 className="font-semibold text-slate-700">HQ · system location</h2>
            <span className="ml-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Not counted
            </span>
          </div>
          <div className="px-5 py-4">
            {editHq ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[240px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">HQ address</label>
                  <input
                    className="input-ui"
                    value={hqForm.address}
                    onChange={(e) => setHqForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="HQ address"
                  />
                </div>
                <button className="btn-brand" onClick={() => updateMut.mutate({ id: hq.id, address: hqForm.address })}>
                  <FiCheck /> Save
                </button>
                <button className="btn-ghost" onClick={() => setEditHq(false)}>
                  <FiX /> Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    HQ <span className="font-mono text-xs text-slate-400">({hq.code})</span>
                    <span className="ml-2 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                      Online inventory
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{hq.address || 'No address saved'}</p>
                </div>
                <button
                  onClick={() => {
                    setHqForm({ address: hq.address || '' });
                    setEditHq(true);
                  }}
                  className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <FiEdit2 size={15} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Add form */}
      {adding && (
        <BranchForm
          onSave={(form) => createMut.mutate(form)}
          onCancel={() => setAdding(false)}
          saving={createMut.isLoading}
        />
      )}

      {/* Grouped list */}
      {Object.entries(grouped).map(([city, cityBranches]) => (
        <section key={city} className="card-ui overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <FiMapPin style={{ color: 'var(--brand-strong)' }} />
            <h2 className="font-semibold text-slate-700">{city || 'Unassigned city'}</h2>
            <span className="ml-1 text-xs text-slate-400">({cityBranches.length})</span>
          </div>
          <div className="divide-y divide-slate-50">
            {cityBranches.map((b) => (
              <div key={b.id}>
                {editId === b.id ? (
                  <div className="p-4">
                    <BranchForm
                      initial={b}
                      onSave={(form) => updateMut.mutate({ id: b.id, ...form })}
                      onCancel={() => setEditId(null)}
                      saving={updateMut.isLoading}
                    />
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{b.name}</p>
                        <span className="font-mono text-[11px] text-slate-400">{b.code}</span>
                        {!b.isActive && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-400">Inactive</span>
                        )}
                      </div>
                      <p className="mb-0.5 text-xs text-slate-500">{b.address}</p>
                      <div className="mt-1 flex flex-wrap gap-4">
                        {b.phone && <span className="text-xs text-slate-400">📞 {b.phone}</span>}
                        {b.offDay && <span className="text-xs text-slate-400">🚫 Off: {b.offDay}</span>}
                        {b.bin && <span className="text-xs text-slate-400">🧾 BIN: {b.bin}</span>}
                        {b.vatPercent != null && (
                          <span className="text-xs text-slate-400">VAT {b.vatPercent}% (override)</span>
                        )}
                        {b.mapLink && (
                          <a
                            href={b.mapLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs hover:underline"
                            style={{ color: 'var(--brand-strong)' }}
                          >
                            📍 Map
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => toggleActive(b)}
                        title={b.isActive ? 'Deactivate' : 'Activate'}
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                          b.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {b.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => {
                          setEditId(b.id);
                          setAdding(false);
                        }}
                        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <FiEdit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id, b.name)}
                        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {branches.length === 0 && !adding && (
        <div className="card-ui border-2 border-dashed py-16 text-center">
          <FiMapPin className="mx-auto mb-3 text-5xl text-slate-200" />
          <p className="text-slate-400">No branches yet. Add your first branch.</p>
        </div>
      )}
    </div>
  );
}
