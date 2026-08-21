'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { MdDragIndicator } from 'react-icons/md';
import {
  FiEdit2, FiTrash2, FiPlus, FiLink, FiEyeOff, FiCheck, FiAlertTriangle, FiSpeaker, FiX
} from 'react-icons/fi';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';

// The storefront's announcement marquee — the strip of moving text between the
// header and the category bar.
//
// It is a list rather than a single field on Site Settings because a shop runs
// two or three notices at once (a delivery cut-off, a campaign, a closed
// showroom) and retires them one at a time. Nothing here has a default: with no
// active row the storefront draws no strip at all, so an empty screen is the
// correct resting state and not a gap to fill.

// Matches the server's cap. Long copy does not survive a single moving line.
const MAX_LENGTH = 200;

const EMPTY_FORM = { text: '', link: '', isActive: true };

function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === 'error';
  return (
    <div
      className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-md shadow-lg text-sm font-medium border
      ${isErr ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
    >
      {isErr ? <FiAlertTriangle className="text-base shrink-0" /> : <FiCheck className="text-base shrink-0" />}
      {toast.msg}
    </div>
  );
}

export default function NoticeBarList() {
  const qc = useQueryClient();

  const [notices, setNotices] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const { isLoading } = useQuery('admin-notice-bar', api.getNoticeBarAdmin, {
    onSuccess: (d) => setNotices(d?.data || []),
    onError: () => showToast('Failed to load notices', 'error')
  });

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModal({ mode: 'add' });
  };
  const openEdit = (notice) => {
    setForm({ text: notice.text || '', link: notice.link || '', isActive: notice.isActive !== false });
    setModal({ mode: 'edit', notice });
  };
  const closeModal = () => {
    setModal(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.text.trim()) return showToast('Please write the notice text', 'error');
    setSaving(true);
    try {
      const payload = { text: form.text.trim(), link: form.link.trim(), isActive: form.isActive };
      if (modal.mode === 'add') {
        await api.createNotice(payload);
        showToast('Notice added');
      } else {
        await api.updateNotice(modal.notice.id, payload);
        showToast('Notice updated');
      }
      closeModal();
      qc.invalidateQueries('admin-notice-bar');
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (notice) => {
    const next = !notice.isActive;
    setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, isActive: next } : n)));
    try {
      await api.updateNotice(notice.id, { isActive: next });
    } catch {
      setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, isActive: notice.isActive } : n)));
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteNotice(id);
      setDeleteConfirm(null);
      showToast('Notice removed');
      qc.invalidateQueries('admin-notice-bar');
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };
  const handleDrop = async (e, toIdx) => {
    e.preventDefault();
    const fromIdx = dragIdx;
    setDragIdx(null);
    setDragOverIdx(null);
    if (fromIdx === null || fromIdx === toIdx) return;

    const reordered = [...notices];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setNotices(reordered);

    try {
      await api.reorderNotices(reordered.map((n) => n.id));
    } catch {
      showToast('Failed to save new order', 'error');
      qc.invalidateQueries('admin-notice-bar');
    }
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const activeNotices = notices.filter((n) => n.isActive);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-44 animate-pulse rounded-md bg-gray-200" />
            <div className="h-4 w-60 animate-pulse rounded-md bg-gray-100" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-md bg-gray-200" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-md border border-gray-200 bg-white p-4">
            <div className="h-8 w-5 animate-pulse rounded-md bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-72 animate-pulse rounded-md bg-gray-100" />
              <div className="h-3 w-40 animate-pulse rounded-md bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toast toast={toast} />

      <PageHeader
        title="Notice Bar"
        icon={FiSpeaker}
        subtitle={
          notices.length === 0
            ? 'Nothing running — the storefront shows no notice strip'
            : (
              <>
                {notices.length} notice{notices.length !== 1 ? 's' : ''}
                {' · '}
                <span className="font-medium text-emerald-600">{activeNotices.length} live</span>
                {notices.length > 1 && <> · drag ⠿ to reorder</>}
              </>
            )
        }
      >
        <button onClick={openAdd} className="btn-brand active:scale-95">
          <FiPlus className="text-base" /> Add Notice
        </button>
      </PageHeader>

      {/* What the customer will actually see. A marquee is one line of moving
          text, so the preview is one line — anything that does not fit here
          will not fit on the storefront either. */}
      {activeNotices.length > 0 && (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Storefront preview
          </p>
          <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap bg-slate-900 px-4 py-2.5 text-sm text-white">
            {activeNotices.map((n) => (
              <span key={n.id} className="flex shrink-0 items-center gap-2">
                <span className="h-1.5 w-1.5 rotate-45 bg-amber-400" />
                {n.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {notices.length === 0 && (
        <div className="rounded-md border-2 border-dashed border-gray-200 bg-gray-50/50 py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-gray-100">
            <FiSpeaker className="text-3xl text-gray-300" />
          </div>
          <p className="font-semibold text-gray-600">No notices</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
            Add one and a scrolling strip appears on the storefront between the header and the category bar. Remove
            them all and the strip disappears again — it is never shown empty.
          </p>
          <button onClick={openAdd} className="btn-brand mt-5">
            <FiPlus /> Add Notice
          </button>
        </div>
      )}

      {notices.length > 0 && (
        <div className="space-y-2">
          {notices.map((notice, i) => (
            <div
              key={notice.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`group flex select-none items-center gap-4 rounded-md border bg-white px-4 py-3 transition-all
                ${dragOverIdx === i && dragIdx !== i ? 'border-[var(--brand)] shadow-md' : 'border-gray-200'}
                ${dragIdx === i ? 'opacity-40' : ''}
                ${notice.isActive ? '' : 'bg-gray-50'}`}
            >
              <MdDragIndicator className="shrink-0 cursor-grab text-xl text-gray-300 group-hover:text-gray-400" />

              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold
                  ${notice.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}
              >
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${notice.isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                  {notice.text}
                </p>
                {notice.link && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                    <FiLink className="shrink-0" /> {notice.link}
                  </p>
                )}
              </div>

              <button
                onClick={() => handleToggleActive(notice)}
                title={notice.isActive ? 'Hide from storefront' : 'Show on storefront'}
                className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors
                  ${notice.isActive
                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                {notice.isActive ? <FiCheck /> : <FiEyeOff />}
                {notice.isActive ? 'Live' : 'Hidden'}
              </button>

              <button
                onClick={() => openEdit(notice)}
                title="Edit"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <FiEdit2 />
              </button>
              <button
                onClick={() => setDeleteConfirm(notice)}
                title="Remove"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / edit modal ──────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-md bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {modal.mode === 'add' ? 'Add Notice' : 'Edit Notice'}
              </h2>
              <button
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label htmlFor="notice-text" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Notice text
                </label>
                <textarea
                  id="notice-text"
                  rows={2}
                  maxLength={MAX_LENGTH}
                  value={form.text}
                  onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                  placeholder="Eid delivery closes 20 June — order now"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  {form.text.length}/{MAX_LENGTH} · one short line reads best on a moving strip
                </p>
              </div>

              <div>
                <label htmlFor="notice-link" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Link <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="notice-link"
                  value={form.link}
                  onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                  placeholder="/campaigns/eid"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">Leave empty and the notice is plain text, not a link.</p>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded-md"
                />
                <span className="text-sm text-slate-700">Show on the storefront</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                onClick={closeModal}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-brand px-5 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Notice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-md bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Remove this notice?</h2>
            <p className="mt-2 truncate text-sm text-slate-500">{deleteConfirm.text}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
