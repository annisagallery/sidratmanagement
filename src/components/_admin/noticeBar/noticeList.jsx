'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { MdAdd, MdArrowDownward, MdArrowUpward, MdCampaign, MdDelete, MdDragIndicator, MdLink } from 'react-icons/md';
import * as api from 'src/services';
import { toastSuccess, alertError, confirmDelete } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Drawer from 'src/components/_admin/ui/Drawer';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { Field, LengthCounter, Switch, Toggle } from 'src/components/_admin/ui/fields';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';

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

/** Add or edit one notice. */
function NoticeDrawer({ mode, notice, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    notice ? { text: notice.text || '', link: notice.link || '', isActive: notice.isActive !== false } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.text.trim()) {
      setError('Write the notice.');
      return;
    }
    setSaving(true);
    try {
      const payload = { text: form.text.trim(), link: form.link.trim(), isActive: form.isActive };
      if (mode === 'add') {
        await api.createNotice(payload);
        toastSuccess('Notice added');
      } else {
        await api.updateNotice(notice.id, payload);
        toastSuccess('Notice saved');
      }
      onSaved();
      onClose();
    } catch (err) {
      alertError(err, { title: mode === 'add' ? 'The notice was not added' : 'The notice was not saved' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={mode === 'add' ? 'Add notice' : 'Edit notice'}
      eyebrow="Notice bar"
      onClose={onClose}
      onSubmit={handleSave}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand">
            {saving ? 'Saving…' : mode === 'add' ? 'Add notice' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Field
          label="Notice"
          required
          error={error}
          help="One short line reads best on a moving strip."
          counter={<LengthCounter value={form.text} max={MAX_LENGTH} />}
        >
          <textarea
            rows={2}
            maxLength={MAX_LENGTH}
            value={form.text}
            onChange={(e) => {
              setForm((f) => ({ ...f, text: e.target.value }));
              setError('');
            }}
            placeholder="Eid delivery closes 20 June — order now"
            className="input-ui min-h-[64px] resize-y py-2"
            autoFocus
          />
        </Field>

        <Field label="Link" optional help="Leave empty and the notice is plain text, not a link.">
          <input
            value={form.link}
            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
            placeholder="/campaigns/eid"
            className="input-ui"
          />
        </Field>

        <Toggle
          label="Show on the storefront"
          help="Hidden notices stay here, ready to switch back on."
          checked={form.isActive}
          onChange={(on) => setForm((f) => ({ ...f, isActive: on }))}
        />
      </div>
    </Drawer>
  );
}

export default function NoticeBarList() {
  const qc = useQueryClient();

  const [notices, setNotices] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [modal, setModal] = useState(null);

  const { isLoading, isError, error, refetch } = useQuery('admin-notice-bar', api.getNoticeBarAdmin, {
    onSuccess: (d) => setNotices(d?.data || [])
  });

  const refresh = () => qc.invalidateQueries('admin-notice-bar');

  const handleToggleActive = async (notice) => {
    const next = !notice.isActive;
    setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, isActive: next } : n)));
    try {
      await api.updateNotice(notice.id, { isActive: next });
    } catch (err) {
      setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, isActive: notice.isActive } : n)));
      alertError(err, { title: next ? 'The notice was not shown' : 'The notice was not hidden' });
    }
  };

  const handleDelete = async (notice) => {
    const confirmed = await confirmDelete({
      title: 'Remove this notice?',
      subject: notice.text,
      text: 'It stops running on the storefront.',
      confirmText: 'Remove notice'
    });
    if (!confirmed) return;
    try {
      await api.deleteNotice(notice.id);
      toastSuccess('Notice removed');
      refresh();
    } catch (err) {
      alertError(err, { title: 'The notice was not removed' });
    }
  };

  // ── Reorder (drag, or Move up / Move down from the row menu) ──────────────

  const move = async (fromIdx, toIdx) => {
    if (fromIdx === null || fromIdx === toIdx || toIdx < 0 || toIdx > notices.length) return;
    const reordered = [...notices];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setNotices(reordered);
    try {
      await api.reorderNotices(reordered.map((n) => n.id));
    } catch (err) {
      alertError(err, { title: 'The new order was not saved' });
      refresh();
    }
  };

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };
  const handleDrop = (e, toIdx) => {
    e.preventDefault();
    const fromIdx = dragIdx;
    setDragIdx(null);
    setDragOverIdx(null);
    move(fromIdx, toIdx);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const activeNotices = notices.filter((n) => n.isActive);
  const addButton = (
    <button type="button" onClick={() => setModal({ mode: 'add' })} className="btn-brand">
      <MdAdd size={18} aria-hidden /> Add notice
    </button>
  );

  let body;
  if (isLoading) {
    body = (
      <ul className="divide-y divide-slate-100" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <li key={i} className="space-y-2 px-5 py-4">
            <div className="skeleton h-4 w-72 max-w-full" />
            <div className="skeleton h-3 w-40" />
          </li>
        ))}
      </ul>
    );
  } else if (isError) {
    body = (
      <div className="p-5">
        <ErrorState error={error} title="The notices could not be loaded" onRetry={refetch} />
      </div>
    );
  } else if (!notices.length) {
    body = (
      <EmptyState
        icon={MdCampaign}
        title="No notices running"
        hint="Add one and a scrolling strip appears on the storefront between the header and the category bar. Remove them all and the strip disappears — it is never shown empty."
        action={addButton}
      />
    );
  } else {
    body = (
      <ol className="divide-y divide-slate-100">
        {notices.map((notice, i) => {
          const isDropTarget = dragOverIdx === i && dragIdx !== null && dragIdx !== i;
          return (
            <li
              key={notice.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`relative flex items-center gap-3 px-3 py-3 transition sm:gap-4 sm:px-5 ${
                dragIdx === i ? 'opacity-40' : 'hover:bg-slate-50'
              }`}
            >
              {isDropTarget && <span className="absolute inset-x-5 -top-px h-0.5 rounded-full bg-slate-900" aria-hidden />}

              <span className="hidden cursor-grab text-slate-400 active:cursor-grabbing sm:block" title="Drag to reorder" aria-hidden>
                <MdDragIndicator size={20} />
              </span>
              <span className="w-5 shrink-0 text-center text-[13px] font-medium tabular-nums text-slate-500">{i + 1}</span>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${notice.isActive ? 'text-slate-900' : 'text-slate-500'}`}>{notice.text}</p>
                {notice.link && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                    <MdLink size={14} className="shrink-0" aria-hidden />
                    <span className="truncate">{notice.link}</span>
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`hidden text-[13px] md:inline ${notice.isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                  {notice.isActive ? 'Live' : 'Hidden'}
                </span>
                <Switch checked={notice.isActive} onChange={() => handleToggleActive(notice)} label={`Show “${notice.text}” on the storefront`} />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setModal({ mode: 'edit', notice })} className="btn-ghost btn-sm">
                  Edit
                </button>
                <ActionMenu
                  label="More actions for this notice"
                  items={[
                    { label: 'Move up', icon: MdArrowUpward, onClick: () => move(i, i - 1), disabled: i === 0 },
                    { label: 'Move down', icon: MdArrowDownward, onClick: () => move(i, i + 1), disabled: i === notices.length - 1 },
                    { label: 'Remove', icon: MdDelete, tone: 'danger', onClick: () => handleDelete(notice) }
                  ]}
                />
              </div>
            </li>
          );
        })}

        {dragIdx !== null && (
          <li
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIdx(notices.length);
            }}
            onDrop={(e) => handleDrop(e, notices.length)}
            className={`m-3 flex h-12 items-center justify-center rounded-md border-2 border-dashed text-[13px] font-medium transition ${
              dragOverIdx === notices.length ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'
            }`}
          >
            Drop here to move to the end
          </li>
        )}
      </ol>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notice bar">{addButton}</PageHeader>

      {/* What the customer will actually see. A marquee is one line of moving
          text, so the preview is one line — anything that does not fit here
          will not fit on the storefront either. */}
      {activeNotices.length > 0 && (
        <Panel title="Storefront preview" description="What shoppers see, one line, scrolling." bodyClassName="!pt-4">
          <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap rounded-md bg-slate-900 px-4 py-2.5 text-sm text-white">
            {activeNotices.map((n) => (
              <span key={n.id} className="flex shrink-0 items-center gap-2">
                <span className="h-1.5 w-1.5 rotate-45 bg-amber-400" aria-hidden />
                {n.text}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="Notices"
        description={
          notices.length
            ? `${activeNotices.length} live${notices.length - activeNotices.length ? ` · ${notices.length - activeNotices.length} hidden` : ''}${
                notices.length > 1 ? ' · drag or use the menu to reorder' : ''
              }`
            : 'Nothing is running — the storefront shows no notice strip.'
        }
        bodyClassName="!p-0"
      >
        <div className="mt-4 border-t border-slate-100">{body}</div>
      </Panel>

      {modal && <NoticeDrawer mode={modal.mode} notice={modal.notice} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}
