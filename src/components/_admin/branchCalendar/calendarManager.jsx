'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { MdAdd, MdCalendarMonth, MdCheck, MdClose, MdDelete, MdSchedule } from 'react-icons/md';
import * as api from 'src/services';
import { alertError, confirmDelete, toastSuccess } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Drawer from 'src/components/_admin/ui/Drawer';
import Segmented from 'src/components/_admin/ui/Segmented';
import Badge from 'src/components/_admin/ui/Badge';
import { Field } from 'src/components/_admin/ui/fields';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';
import WeeklyHoursEditor, { seedWeek } from 'src/components/_admin/branches/weeklyHoursEditor';

// Branch calendar entries awaiting a decision, and the record of the ones
// already decided. A branch marks a date and it lands here as PENDING; nothing
// changes what the storefront says until someone approves it on this screen.
//
// An entry runs in one of two directions — a closure on a working day, or
// trading on the branch's weekly off day — and the direction matters more than
// the date does, so it is the first thing each row states.
//
// The weekly schedule sits on this screen too, above the queue. The two belong
// together: an entry only *is* an exception by disagreeing with the schedule,
// so reviewing a request without being able to see — or fix — the week it
// departs from means guessing. Editing it here is the same write as editing it
// in Branches settings.
//
// Pending is the default filter because it is the only state that needs
// anybody to do anything.

const STATUS_TABS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: '', label: 'All' }
];

const KIND_TABS = [
  { value: '', label: 'All kinds' },
  { value: 'CLOSED', label: 'Closures' },
  { value: 'OPEN', label: 'Special openings' }
];

const STATUS_BADGE = {
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'neutral' }
};

const KIND_BADGE = {
  CLOSED: { label: 'Closed', tone: 'danger' },
  OPEN: { label: 'Open', tone: 'success' }
};

const formatDate = (isoDate) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${isoDate}T00:00:00Z`));

const EMPTY_FORM = { branch: '', date: '', kind: 'CLOSED', openTime: '', closeTime: '', reason: '' };

/** Admin-added dates skip the queue — creating one here is the approval. */
function AddEntryDrawer({ branchList, onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const put = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const add = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.branch) next.branch = 'Choose the branch.';
    if (!form.date) next.date = 'Choose the date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await api.createBranchCalendarEntry(form);
      toastSuccess('Date added and approved');
      onAdded();
      onClose();
    } catch (err) {
      alertError(err, { title: 'The date was not added' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="Add a calendar date"
      eyebrow="Branch calendar"
      onClose={onClose}
      onSubmit={add}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-brand" disabled={saving}>
            {saving ? 'Adding…' : 'Add and approve'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-[13px] text-slate-600">Dates added here are approved straight away and change the storefront immediately.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Branch" required error={errors.branch}>
            <select value={form.branch} onChange={(e) => put('branch', e.target.value)} className="select-ui w-full">
              <option value="">Choose a branch…</option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date" required error={errors.date}>
            <input type="date" value={form.date} onChange={(e) => put('date', e.target.value)} className="input-ui" />
          </Field>
        </div>
        <Field label="That day the branch is">
          <Segmented
            label="That day the branch is"
            options={[
              { id: 'CLOSED', label: 'Closed' },
              { id: 'OPEN', label: 'Open' }
            ]}
            value={form.kind}
            onChange={(v) => put('kind', v)}
          />
        </Field>
        {/* Hours only mean something on a day the branch will be open. */}
        {form.kind === 'OPEN' && (
          <div className="space-y-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opens" optional>
                <input type="time" value={form.openTime} onChange={(e) => put('openTime', e.target.value)} className="input-ui" />
              </Field>
              <Field label="Closes" optional>
                <input type="time" value={form.closeTime} onChange={(e) => put('closeTime', e.target.value)} className="input-ui" />
              </Field>
            </div>
            <p className="text-[13px] text-slate-500">Leave blank to use the branch&apos;s regular hours.</p>
          </div>
        )}
        <Field label="Reason" optional>
          <input value={form.reason} onChange={(e) => put('reason', e.target.value)} placeholder="e.g. Eid holiday" className="input-ui" />
        </Field>
      </div>
    </Drawer>
  );
}

export default function BranchCalendarManager() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [kind, setKind] = useState('');
  const [branchId, setBranchId] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [scheduleFor, setScheduleFor] = useState('');
  const [draftWeek, setDraftWeek] = useState(null);
  const [savingWeek, setSavingWeek] = useState(false);

  const query = [status ? `status=${status}` : '', kind ? `kind=${kind}` : '', branchId ? `branch=${branchId}` : '']
    .filter(Boolean)
    .join('&');

  const { data, isLoading, isError, error, refetch } = useQuery(['admin-branch-calendar', status, kind, branchId], () =>
    api.getBranchCalendar(query ? `?${query}` : '')
  );
  const { data: branches } = useQuery('admin-branches-calendar', api.adminGetBranches);

  const rows = data?.data || [];
  const branchList = (branches?.data || []).filter((b) => b.type !== 'ECOM');

  // The schedule panel edits one branch at a time. It follows the branch filter
  // when one is set, so filtering to a branch to review its requests also puts
  // its week on screen.
  const scheduleBranch = branchList.find((b) => b.id === (branchId || scheduleFor)) || null;

  const refresh = () => qc.invalidateQueries(['admin-branch-calendar']);

  const review = async (id, nextStatus) => {
    setBusyId(id);
    try {
      await api.reviewBranchCalendarEntry(id, { status: nextStatus });
      toastSuccess(nextStatus === 'APPROVED' ? 'Approved' : 'Rejected');
      refresh();
    } catch (err) {
      alertError(err, { title: 'That decision was not saved' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row) => {
    const confirmed = await confirmDelete({
      title: 'Remove this date?',
      subject: `${row.branch?.name || 'Branch'} · ${formatDate(row.date)}`,
      text: 'The branch goes back to its weekly schedule for that day.',
      confirmText: 'Remove date',
      recoverable: false
    });
    if (!confirmed) return;
    setBusyId(row.id);
    try {
      await api.deleteBranchCalendarEntry(row.id);
      toastSuccess('Removed from the calendar');
      refresh();
    } catch (err) {
      alertError(err, { title: 'That date was not removed' });
    } finally {
      setBusyId(null);
    }
  };

  const saveWeek = async () => {
    if (!scheduleBranch || !draftWeek) return;
    setSavingWeek(true);
    try {
      await api.adminUpdateBranch({
        id: scheduleBranch.id,
        weeklyHours: seedWeek(draftWeek, scheduleBranch)
      });
      toastSuccess(`${scheduleBranch.name} schedule saved`);
      setDraftWeek(null);
      qc.invalidateQueries('admin-branches-calendar');
      // Entries are read against the schedule, so the queue restates itself.
      refresh();
    } catch (err) {
      alertError(err, { title: 'The schedule was not saved' });
    } finally {
      setSavingWeek(false);
    }
  };

  let list;
  if (isLoading) {
    list = (
      <ul className="divide-y divide-slate-100" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <li key={i} className="space-y-2 px-5 py-4">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-3 w-72 max-w-full" />
          </li>
        ))}
      </ul>
    );
  } else if (isError) {
    list = (
      <div className="p-5">
        <ErrorState error={error} title="The calendar could not be loaded" onRetry={refetch} />
      </div>
    );
  } else if (!rows.length) {
    list = (
      <EmptyState
        icon={MdCalendarMonth}
        title={status === 'PENDING' ? 'Nothing waiting for approval' : 'No dates here'}
        hint={status === 'PENDING' ? 'Dates a branch marks in the branch app show up here.' : 'Try another status, kind or branch.'}
      />
    );
  } else {
    list = (
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => {
          const kindBadge = KIND_BADGE[row.kind] || KIND_BADGE.CLOSED;
          const statusBadge = STATUS_BADGE[row.status] || { label: row.status, tone: 'neutral' };
          const busy = busyId === row.id;
          return (
            <li key={row.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={kindBadge.tone}>{kindBadge.label}</Badge>
                  <p className="text-[13px] font-semibold text-slate-900">{formatDate(row.date)}</p>
                  <span className="text-[13px] text-slate-600">· {row.branch?.name}</span>
                  <Badge tone={statusBadge.tone} dot>
                    {statusBadge.label}
                  </Badge>
                </div>
                <p className="mt-1 text-[13px] text-slate-700">{row.reason || <span className="text-slate-500">No reason given</span>}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  {row.kind === 'OPEN' && (row.openTime || row.closeTime) && (
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                      <MdSchedule size={14} aria-hidden />
                      {row.openTime || '—'}–{row.closeTime || '—'}
                    </span>
                  )}
                  <span>
                    {row.requestedBy?.name ? `Requested by ${row.requestedBy.name}` : 'Requested from the branch app'}
                    {row.reviewedBy?.name ? ` · Reviewed by ${row.reviewedBy.name}` : ''}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {row.status !== 'APPROVED' && (
                  <button type="button" onClick={() => review(row.id, 'APPROVED')} disabled={busy} className="btn-brand btn-sm">
                    <MdCheck size={16} aria-hidden /> Approve
                  </button>
                )}
                {row.status !== 'REJECTED' && (
                  <button type="button" onClick={() => review(row.id, 'REJECTED')} disabled={busy} className="btn-ghost btn-sm">
                    <MdClose size={16} aria-hidden /> Reject
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(row)}
                  disabled={busy}
                  title="Remove date"
                  aria-label={`Remove ${formatDate(row.date)} for ${row.branch?.name || 'this branch'}`}
                  className="btn-icon btn-icon-sm btn-icon-danger"
                >
                  <MdDelete size={17} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch calendar"
        subtitle="Closures, trading on a weekly off day, and the hours for a date. A branch's request only changes the storefront once it is approved here."
      >
        <button type="button" onClick={() => setAdding(true)} className="btn-brand">
          <MdAdd size={18} aria-hidden /> Add date
        </button>
      </PageHeader>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="card-ui min-w-0 overflow-hidden" aria-labelledby="calendar-queue-title">
          <header className="space-y-3 border-b border-slate-200 px-5 py-4">
            <h2 id="calendar-queue-title" className="text-[15px] font-semibold text-slate-900">
              Requests
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented label="Status" options={STATUS_TABS} value={status} onChange={setStatus} />
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="select-ui" aria-label="Kind">
                {KIND_TABS.map((t) => (
                  <option key={t.value || 'all'} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="select-ui" aria-label="Branch">
                <option value="">All branches</option>
                {branchList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </header>
          {list}
        </section>

        {/* Weekly schedule — the baseline every entry is an exception to */}
        <Panel
          title="Weekly schedule"
          description="The default week. Every date on the left is an exception to it."
          className="xl:sticky xl:top-0"
        >
          <div className="space-y-4">
            <Field label="Branch">
              <select
                value={branchId || scheduleFor}
                onChange={(e) => {
                  setScheduleFor(e.target.value);
                  setDraftWeek(null);
                }}
                disabled={Boolean(branchId)}
                className="select-ui w-full"
              >
                <option value="">Choose a branch…</option>
                {branchList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>

            {scheduleBranch ? (
              <>
                <WeeklyHoursEditor
                  key={scheduleBranch.id}
                  value={draftWeek ?? scheduleBranch.weeklyHours}
                  legacy={scheduleBranch}
                  onChange={setDraftWeek}
                />
                <div className="flex items-center justify-end gap-2">
                  {draftWeek && (
                    <button type="button" onClick={() => setDraftWeek(null)} className="btn-ghost">
                      Discard changes
                    </button>
                  )}
                  <button type="button" onClick={saveWeek} disabled={!draftWeek || savingWeek} className="btn-brand">
                    {savingWeek ? 'Saving…' : 'Save schedule'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-slate-500">Choose a branch to see or change its week.</p>
            )}
          </div>
        </Panel>
      </div>

      {adding && <AddEntryDrawer branchList={branchList} onClose={() => setAdding(false)} onAdded={refresh} />}
    </div>
  );
}
