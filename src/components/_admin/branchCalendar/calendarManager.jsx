'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { FiCheck, FiX, FiAlertTriangle, FiPlus, FiTrash2, FiCalendar, FiClock } from 'react-icons/fi';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
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
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '', label: 'All' }
];

const KIND_TABS = [
  { value: '', label: 'All kinds' },
  { value: 'CLOSED', label: 'Closures' },
  { value: 'OPEN', label: 'Special openings' }
];

const STATUS_BADGE = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-slate-100 text-slate-500 border-slate-200'
};

const KIND_BADGE = {
  CLOSED: { label: 'Closed', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  OPEN: { label: 'Open', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
};

const formatDate = (isoDate) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${isoDate}T00:00:00Z`));

function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === 'error';
  return (
    <div
      className={`fixed right-5 top-5 z-[100] flex items-center gap-2.5 rounded-md border px-4 py-3 text-sm font-medium shadow-lg
      ${isErr ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
    >
      {isErr ? <FiAlertTriangle className="shrink-0" /> : <FiCheck className="shrink-0" />}
      {toast.msg}
    </div>
  );
}

const EMPTY_FORM = { branch: '', date: '', kind: 'CLOSED', openTime: '', closeTime: '', reason: '' };

export default function BranchCalendarManager() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [kind, setKind] = useState('');
  const [branchId, setBranchId] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scheduleFor, setScheduleFor] = useState('');
  const [draftWeek, setDraftWeek] = useState(null);
  const [savingWeek, setSavingWeek] = useState(false);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const query = [status ? `status=${status}` : '', kind ? `kind=${kind}` : '', branchId ? `branch=${branchId}` : '']
    .filter(Boolean)
    .join('&');

  const { data, isLoading } = useQuery(['admin-branch-calendar', status, kind, branchId], () =>
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
      showToast(nextStatus === 'APPROVED' ? 'Approved' : 'Rejected');
      refresh();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save that decision', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    setBusyId(id);
    try {
      await api.deleteBranchCalendarEntry(id);
      showToast('Removed from the calendar');
      refresh();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not remove that date', 'error');
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
      showToast(`${scheduleBranch.name} schedule saved`);
      setDraftWeek(null);
      qc.invalidateQueries('admin-branches-calendar');
      // Entries are read against the schedule, so the queue restates itself.
      refresh();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save the schedule', 'error');
    } finally {
      setSavingWeek(false);
    }
  };

  const add = async () => {
    if (!form.branch || !form.date) return showToast('Pick a branch and a date', 'error');
    try {
      await api.createBranchCalendarEntry(form);
      showToast('Added and approved');
      setAdding(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not add that date', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast} />

      <PageHeader
        title="Branch Calendar"
        subtitle="Closures, trading on a weekly off day, and the hours for a date. A branch's request only changes the storefront once it is approved here."
      >
        <button onClick={() => setAdding((v) => !v)} className="btn-brand active:scale-95">
          <FiPlus className="text-base" /> Add Entry
        </button>
      </PageHeader>

      {/* Admin-added dates skip the queue — creating one here is the approval. */}
      {adding && (
        <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <select
              value={form.branch}
              onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
              className="select-ui w-full"
            >
              <option value="">Select branch…</option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
            />
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              className="select-ui w-full"
            >
              <option value="CLOSED">Closed that day</option>
              <option value="OPEN">Open that day</option>
            </select>
            <input
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Reason"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {/* Hours only mean something on a day the branch will be open. */}
            {form.kind === 'OPEN' && (
              <>
                <label className="text-xs font-semibold text-gray-600">
                  Opens
                  <input
                    type="time"
                    value={form.openTime}
                    onChange={(e) => setForm((f) => ({ ...f, openTime: e.target.value }))}
                    className="mt-1 block rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </label>
                <label className="text-xs font-semibold text-gray-600">
                  Closes
                  <input
                    type="time"
                    value={form.closeTime}
                    onChange={(e) => setForm((f) => ({ ...f, closeTime: e.target.value }))}
                    className="mt-1 block rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                  />
                </label>
                <p className="pb-2.5 text-[11px] text-gray-400">Leave blank to use the branch&apos;s regular hours.</p>
              </>
            )}
            <button onClick={add} className="btn-brand ml-auto">
              Add &amp; approve
            </button>
          </div>
        </div>
      )}

      {/* Weekly schedule — the baseline every entry below is an exception to */}
      <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-800">Weekly schedule</p>
            <p className="text-xs text-gray-400">
              The default week. Everything below is an exception to it.
            </p>
          </div>
          <select
            value={branchId || scheduleFor}
            onChange={(e) => {
              setScheduleFor(e.target.value);
              setDraftWeek(null);
            }}
            className="select-ui"
          >
            <option value="">Pick a branch…</option>
            {branchList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {scheduleBranch && (
          <>
            <WeeklyHoursEditor
              key={scheduleBranch.id}
              value={draftWeek ?? scheduleBranch.weeklyHours}
              legacy={scheduleBranch}
              onChange={setDraftWeek}
            />
            <div className="flex items-center justify-end gap-2">
              {draftWeek && (
                <button onClick={() => setDraftWeek(null)} className="btn-ghost text-sm">
                  Discard
                </button>
              )}
              <button onClick={saveWeek} disabled={!draftWeek || savingWeek} className="btn-brand">
                {savingWeek ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              onClick={() => setStatus(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                status === tab.value
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select value={kind} onChange={(e) => setKind(e.target.value)} className="select-ui">
          {KIND_TABS.map((t) => (
            <option key={t.value || 'all'} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="select-ui">
          <option value="">All branches</option>
          {branchList.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-gray-100">
            <FiCalendar className="text-2xl text-gray-300" />
          </div>
          <p className="font-semibold text-gray-600">
            {status === 'PENDING' ? 'Nothing waiting for approval' : 'No entries here'}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {status === 'PENDING'
              ? 'Dates a branch marks in the branch app show up here.'
              : 'Try another status, kind or branch.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const kindBadge = KIND_BADGE[row.kind] || KIND_BADGE.CLOSED;
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-4 rounded-md border border-gray-200 bg-white px-4 py-3"
              >
                <span
                  className={`w-[70px] shrink-0 rounded-md border px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider ${kindBadge.className}`}
                >
                  {kindBadge.label}
                </span>

                <div className="min-w-[180px]">
                  <p className="text-sm font-bold text-gray-800">{formatDate(row.date)}</p>
                  <p className="text-xs text-gray-500">{row.branch?.name}</p>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-600">
                    {row.reason || <span className="italic text-gray-300">No reason given</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
                    {row.kind === 'OPEN' && (row.openTime || row.closeTime) && (
                      <span className="flex items-center gap-1 font-semibold text-gray-500">
                        <FiClock className="text-[10px]" />
                        {row.openTime || '—'}–{row.closeTime || '—'}
                      </span>
                    )}
                    <span>
                      {row.requestedBy?.name ? `Requested by ${row.requestedBy.name}` : 'Requested from the branch app'}
                      {row.reviewedBy?.name ? ` · Reviewed by ${row.reviewedBy.name}` : ''}
                    </span>
                  </p>
                </div>

                <span
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[row.status]}`}
                >
                  {row.status}
                </span>

                <div className="flex items-center gap-1">
                  {row.status !== 'APPROVED' && (
                    <button
                      onClick={() => review(row.id, 'APPROVED')}
                      disabled={busyId === row.id}
                      className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                    >
                      <FiCheck /> Approve
                    </button>
                  )}
                  {row.status !== 'REJECTED' && (
                    <button
                      onClick={() => review(row.id, 'REJECTED')}
                      disabled={busyId === row.id}
                      className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                      <FiX /> Reject
                    </button>
                  )}
                  <button
                    onClick={() => remove(row.id)}
                    disabled={busyId === row.id}
                    title="Delete"
                    className="rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <FiTrash2 className="text-sm" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
