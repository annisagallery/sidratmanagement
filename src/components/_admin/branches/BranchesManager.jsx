'use client';
import WeeklyHoursEditor, { seedWeek } from './weeklyHoursEditor';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { MdAdd, MdArchive, MdEdit, MdLocationOn, MdOpenInNew, MdStore } from 'react-icons/md';
import { adminGetBranches, adminCreateBranch, adminUpdateBranch, adminDeleteBranch } from 'src/services';
import { alertError, confirmAction, toastSuccess } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Drawer from 'src/components/_admin/ui/Drawer';
import Badge from 'src/components/_admin/ui/Badge';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { Field, Switch, Toggle } from 'src/components/_admin/ui/fields';
import { EmptyState, ErrorState, LoadingBlock } from 'src/components/_admin/ui/TableStates';

// Index order matters here: it lines up with the weekly schedule, where 0 is Sunday.
const DAYS_IN_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY = {
  name: '',
  code: '',
  city: '',
  address: '',
  phone: '',
  // offDay / openTime / closeTime are still written by the server from the
  // weekly schedule; the form no longer edits them directly.
  offDay: '',
  openTime: '',
  closeTime: '',
  weeklyHours: null,
  mapLink: '',
  bin: '',
  vatPercent: null,
  receiptNote: '',
  isActive: true,
  order: 0
};

const REQUIRED = {
  name: 'Give the branch a name.',
  code: 'Give the branch a short code.',
  city: 'Enter the city.',
  address: 'Enter the address.'
};

function FormSection({ title, description, children }) {
  return (
    <section className="space-y-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function BranchDrawer({ initial, onSave, onClose, saving }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(initial || EMPTY);
  const [errors, setErrors] = useState({});
  const put = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const set = (k) => (e) => put(k, e.target.value);

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    Object.entries(REQUIRED).forEach(([key, message]) => {
      if (!String(form[key] || '').trim()) next[key] = message;
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave({
      ...form,
      weeklyHours: seedWeek(form.weeklyHours, {
        offDay: form.offDay,
        openTime: form.openTime,
        closeTime: form.closeTime
      }),
      bin: (form.bin || '').trim(),
      vatPercent: form.vatPercent === '' || form.vatPercent == null ? null : Number(form.vatPercent)
    });
  };

  return (
    <Drawer
      title={editing ? `Edit ${initial.name}` : 'Add branch'}
      eyebrow="Branches"
      size="lg"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add branch'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <FormSection title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name}>
              <input className="input-ui" value={form.name} onChange={set('name')} placeholder="e.g. Bashundhara Branch" autoFocus={!editing} />
            </Field>
            <Field label="Code" required error={errors.code} help="Short, in capitals. Printed on receipts and dockets.">
              <input
                className="input-ui ops-code uppercase"
                value={form.code}
                onChange={(e) => put('code', e.target.value.toUpperCase())}
                placeholder="BSD"
                spellCheck={false}
              />
            </Field>
            <Field label="City" required error={errors.city} help="Branches are grouped by city on the storefront.">
              <input className="input-ui" value={form.city} onChange={set('city')} placeholder="e.g. Dhaka" />
            </Field>
            <Field label="Phone" optional>
              <input className="input-ui" type="tel" value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
            </Field>
            <Field label="Address" required error={errors.address} className="sm:col-span-2">
              <input className="input-ui" value={form.address} onChange={set('address')} placeholder="Full address" />
            </Field>
            <Field label="Google Maps link" optional className="sm:col-span-2">
              <input className="input-ui" type="url" value={form.mapLink} onChange={set('mapLink')} placeholder="https://maps.google.com/…" />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Opening hours">
          <WeeklyHoursEditor
            value={form.weeklyHours}
            legacy={{ offDay: form.offDay, openTime: form.openTime, closeTime: form.closeTime }}
            onChange={(weeklyHours) => setForm((p) => ({ ...p, weeklyHours }))}
          />
        </FormSection>

        <FormSection title="Receipts" description="Leave blank to use the global POS settings.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="BIN (VAT registration no.)" optional help="Printed on POS receipts.">
              <input className="input-ui ops-code" value={form.bin || ''} onChange={set('bin')} />
            </Field>
            <Field label="VAT %" optional help="Overrides the global POS rate.">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.1"
                className="input-ui tabular-nums"
                value={form.vatPercent ?? ''}
                onChange={(e) => put('vatPercent', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              />
            </Field>
            <Field label="Receipt note" optional help="Overrides the global receipt note." className="sm:col-span-2">
              <input className="input-ui" maxLength={500} value={form.receiptNote || ''} onChange={set('receiptNote')} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Display">
          <Field label="Sort order" help="Lower numbers are listed first." className="sm:max-w-[200px]">
            <input type="number" inputMode="numeric" className="input-ui tabular-nums" value={form.order} onChange={set('order')} min={0} />
          </Field>
          <Toggle
            label="Active"
            help="Active branches are shown on the storefront."
            checked={form.isActive}
            onChange={(on) => put('isActive', on)}
          />
        </FormSection>
      </div>
    </Drawer>
  );
}

function BranchMeta({ branch }) {
  const week = seedWeek(branch.weeklyHours, branch);
  const shut = week.map((d, i) => (d.isOpen ? null : DAYS_IN_ORDER[i])).filter(Boolean);
  const trading = week.find((d) => d.isOpen && d.openTime && d.closeTime);
  const parts = [
    branch.phone,
    trading ? `${trading.openTime}–${trading.closeTime}` : null,
    shut.length ? `Closed ${shut.join(', ')}` : null,
    branch.bin ? `BIN ${branch.bin}` : null,
    branch.vatPercent != null ? `VAT ${branch.vatPercent}%` : null
  ].filter(Boolean);
  return parts.length ? <p className="mt-1 text-xs text-slate-500">{parts.join(' · ')}</p> : null;
}

export default function BranchesManager() {
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState(null); // null | { branch?: object }
  const [editHq, setEditHq] = useState(false);
  const [hqForm, setHqForm] = useState({ address: '' });

  const { data, isLoading, isError, error, refetch } = useQuery('admin-branches', adminGetBranches);
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
      toastSuccess('Branch added');
      setDrawer(null);
      invalidate();
    },
    onError: (e) => alertError(e, { title: 'The branch was not added' })
  });

  const updateMut = useMutation(adminUpdateBranch, {
    onSuccess: () => {
      toastSuccess('Branch saved');
      setDrawer(null);
      setEditHq(false);
      invalidate();
    },
    onError: (e) => alertError(e, { title: 'The branch was not saved' })
  });

  const deleteMut = useMutation(adminDeleteBranch, {
    onSuccess: () => {
      toastSuccess('Branch archived');
      invalidate();
    },
    onError: (e) => alertError(e, { title: 'The branch was not archived' })
  });

  const handleDelete = async (branch) => {
    const confirmed = await confirmAction({
      tone: 'danger',
      title: 'Archive this branch?',
      subject: branch.name,
      text: 'Its saved data is kept, but it is removed from the storefront.',
      confirmText: 'Archive branch'
    });
    if (confirmed) deleteMut.mutate(branch.id);
  };
  const toggleActive = (b) => updateMut.mutate({ id: b.id, isActive: !b.isActive });

  const addButton = (
    <button type="button" onClick={() => setDrawer({})} className="btn-brand">
      <MdAdd size={18} aria-hidden /> Add branch
    </button>
  );

  let body;
  if (isLoading) body = <LoadingBlock />;
  else if (isError) body = <ErrorState error={error} title="The branches could not be loaded" onRetry={refetch} />;
  else
    body = (
      <>
        {/* HQ — system location (not a branch, never on storefront) */}
        {hq && (
          <Panel
            title="Head office"
            description="A system location for online inventory. It is not a branch and never appears on the storefront."
            action={
              !editHq && (
                <button
                  type="button"
                  onClick={() => {
                    setHqForm({ address: hq.address || '' });
                    setEditHq(true);
                  }}
                  className="btn-ghost btn-sm"
                >
                  <MdEdit size={16} aria-hidden /> Edit address
                </button>
              )
            }
          >
            {editHq ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateMut.mutate({ id: hq.id, address: hqForm.address });
                }}
                className="flex flex-wrap items-end gap-2"
              >
                <Field label="Head office address" className="min-w-[240px] flex-1">
                  <input
                    className="input-ui"
                    value={hqForm.address}
                    onChange={(e) => setHqForm((p) => ({ ...p, address: e.target.value }))}
                    autoFocus
                  />
                </Field>
                <button type="button" className="btn-ghost" onClick={() => setEditHq(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-brand" disabled={updateMut.isLoading}>
                  {updateMut.isLoading ? 'Saving…' : 'Save'}
                </button>
              </form>
            ) : (
              <div className="flex items-start gap-3">
                <MdStore size={20} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <p className="text-[13px] font-medium text-slate-900">
                    HQ <span className="ops-code ml-1 text-xs font-normal text-slate-500">{hq.code}</span>
                    <Badge tone="info" className="ml-2">
                      Online inventory
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-[13px] text-slate-600">{hq.address || 'No address saved'}</p>
                </div>
              </div>
            )}
          </Panel>
        )}

        {branches.length === 0 ? (
          <div className="card-ui">
            <EmptyState icon={MdLocationOn} title="No branches yet" hint="Add your first branch to show it on the storefront." action={addButton} />
          </div>
        ) : (
          Object.entries(grouped).map(([city, cityBranches]) => (
            <section key={city} className="card-ui overflow-hidden" aria-label={city || 'No city'}>
              <header className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5">
                <MdLocationOn size={18} className="text-slate-400" aria-hidden />
                <h2 className="text-[15px] font-semibold text-slate-900">{city || 'No city'}</h2>
                <span className="text-[13px] text-slate-500">{cityBranches.length}</span>
              </header>
              <ul className="divide-y divide-slate-100">
                {cityBranches.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-slate-900">{b.name}</p>
                        <span className="ops-code text-xs text-slate-500">{b.code}</span>
                        {!b.isActive && <Badge>Inactive</Badge>}
                      </div>
                      <p className="mt-0.5 text-[13px] text-slate-600">{b.address}</p>
                      <BranchMeta branch={b} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-[13px] text-slate-600 sm:inline">{b.isActive ? 'Active' : 'Inactive'}</span>
                      <Switch checked={b.isActive} onChange={() => toggleActive(b)} label={`${b.name} is active`} disabled={updateMut.isLoading} />
                      <button type="button" onClick={() => setDrawer({ branch: b })} className="btn-ghost btn-sm">
                        Edit
                      </button>
                      <ActionMenu
                        label={`More actions for ${b.name}`}
                        items={[
                          b.mapLink
                            ? { label: 'Open in Google Maps', icon: MdOpenInNew, onClick: () => window.open(b.mapLink, '_blank', 'noopener,noreferrer') }
                            : null,
                          { label: 'Archive', icon: MdArchive, tone: 'danger', onClick: () => handleDelete(b) }
                        ]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        subtitle={`${branches.length} branch${branches.length !== 1 ? 'es' : ''}, grouped by city on the storefront`}
      >
        {addButton}
      </PageHeader>

      {body}

      {drawer && (
        <BranchDrawer
          initial={drawer.branch}
          saving={createMut.isLoading || updateMut.isLoading}
          onSave={(form) => (drawer.branch ? updateMut.mutate({ id: drawer.branch.id, ...form }) : createMut.mutate(form))}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
