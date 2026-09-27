'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Image from 'next/image';
import { MdAdd, MdArrowDownward, MdArrowUpward, MdDelete, MdDragIndicator, MdImage, MdLink, MdRateReview, MdVisibilityOff } from 'react-icons/md';
import * as api from 'src/services';
import { toastSuccess, alertError, confirmDelete } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Drawer from 'src/components/_admin/ui/Drawer';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { Field, Switch, Toggle } from 'src/components/_admin/ui/fields';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';

// Homepage customer reviews. Deliberately the same screen as Home Banners, with
// the banner's title/subtitle replaced by a single reviewer name — the uploaded
// screenshot is the review, so there is no copy to write, only who said it.

const EMPTY_FORM = {
  name: '',
  link: '',
  alt: '',
  isActive: true,
  imageId: null,
  imagePath: null
};

/** Add or edit one review. Owns its form; the list only hears "saved". */
function ReviewDrawer({ mode, review, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState(() =>
    review
      ? {
          name: review.name || '',
          link: review.link || '',
          alt: review.alt || '',
          isActive: review.isActive !== false,
          imageId: review.image?.id || null,
          imagePath: review.image?.path || null
        }
      : EMPTY_FORM
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'HomeReview');
      const res = await api.uploadImage(fd);
      setForm((f) => ({ ...f, imageId: res.id, imagePath: res.path }));
      setErrors((p) => ({ ...p, image: undefined }));
    } catch (err) {
      alertError(err, { title: 'The screenshot was not uploaded' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.imageId) next.image = 'Upload the review screenshot.';
    if (!form.name.trim()) next.name = 'Enter the name of the customer who wrote it.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const payload = {
        image: form.imageId,
        name: form.name.trim(),
        link: form.link,
        alt: form.alt,
        isActive: form.isActive
      };
      if (mode === 'add') {
        await api.createHomeReview(payload);
        toastSuccess('Review added');
      } else {
        await api.updateHomeReview(review.id, payload);
        toastSuccess('Review saved');
      }
      onSaved();
      onClose();
    } catch (err) {
      alertError(err, { title: mode === 'add' ? 'The review was not added' : 'The review was not saved' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={mode === 'add' ? 'Add customer review' : 'Edit customer review'}
      eyebrow="Homepage"
      onClose={onClose}
      onSubmit={handleSave}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving || uploading} className="btn-brand">
            {saving ? 'Saving…' : mode === 'add' ? 'Add review' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-slate-800">
            Screenshot
            <span className="ml-0.5 text-rose-600" aria-hidden>
              *
            </span>
          </p>
          <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {form.imagePath ? (
              <Image src={form.imagePath} alt="Review screenshot preview" fill className="object-contain" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[13px] text-slate-500">
                <MdImage size={26} className="text-slate-400" aria-hidden />
                {uploading ? 'Uploading…' : 'No screenshot yet'}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-slate-500">PNG, JPG or WEBP. Square works best; nothing is cropped.</p>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-ghost btn-sm">
              {uploading ? 'Uploading…' : form.imagePath ? 'Replace screenshot' : 'Upload screenshot'}
            </button>
          </div>
          {errors.image && (
            <p className="mt-1.5 text-[13px] font-medium text-rose-700" role="alert">
              {errors.image}
            </p>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} tabIndex={-1} aria-hidden />
        </div>

        <Field label="Customer name" required error={errors.name} help="Printed on the card, under the screenshot.">
          <input value={form.name} onChange={set('name')} placeholder="e.g. Farhana Akter" className="input-ui" />
        </Field>
        <Field label="Link" optional help="Opened when the card is tapped. Link the original post so shoppers can check it.">
          <input value={form.link} onChange={set('link')} placeholder="Facebook post link" className="input-ui" />
        </Field>
        <Field label="Image description" optional help="Read aloud by screen readers and used by search engines.">
          <input value={form.alt} onChange={set('alt')} placeholder="Describe the screenshot" className="input-ui" />
        </Field>

        <Toggle
          label="Show on the homepage"
          help="Only reviews that are on appear in the carousel."
          checked={form.isActive}
          onChange={(on) => setForm((f) => ({ ...f, isActive: on }))}
        />
      </div>
    </Drawer>
  );
}

export default function HomeReviewList() {
  const qc = useQueryClient();

  const [localReviews, setLocalReviews] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [modal, setModal] = useState(null);

  const { isLoading, isError, error, refetch } = useQuery('admin-home-reviews', api.getHomeReviewsAdmin, {
    onSuccess: (d) => setLocalReviews(d?.data || [])
  });

  const refresh = () => qc.invalidateQueries('admin-home-reviews');

  // ── Active toggle ──────────────────────────────────────────────────────────

  const handleToggleActive = async (review) => {
    const next = !review.isActive;
    setLocalReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, isActive: next } : r)));
    try {
      await api.updateHomeReview(review.id, { isActive: next });
    } catch (err) {
      setLocalReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, isActive: review.isActive } : r)));
      alertError(err, { title: next ? 'The review was not shown' : 'The review was not hidden' });
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (review, i) => {
    const confirmed = await confirmDelete({
      title: 'Delete this review?',
      subject: review.name || `Review ${i + 1}`,
      text: 'It is removed from the homepage carousel.'
    });
    if (!confirmed) return;
    try {
      await api.deleteHomeReview(review.id);
      toastSuccess('Review deleted');
      refresh();
    } catch (err) {
      alertError(err, { title: 'The review was not deleted' });
    }
  };

  // ── Reorder (drag, or Move up / Move down from the row menu) ──────────────

  const move = async (fromIdx, toIdx) => {
    if (fromIdx === null || fromIdx === toIdx || toIdx < 0 || toIdx > localReviews.length) return;
    const reordered = [...localReviews];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalReviews(reordered);
    try {
      await api.reorderHomeReviews(reordered.map((r) => r.id));
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

  const activeCount = localReviews.filter((r) => r.isActive).length;
  const hiddenCount = localReviews.length - activeCount;
  const addButton = (
    <button type="button" onClick={() => setModal({ mode: 'add' })} className="btn-brand">
      <MdAdd size={18} aria-hidden /> Add review
    </button>
  );

  let body;
  if (isLoading) {
    body = (
      <ul className="divide-y divide-slate-100" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="skeleton h-20 w-20 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-56" />
            </div>
          </li>
        ))}
      </ul>
    );
  } else if (isError) {
    body = (
      <div className="p-5">
        <ErrorState error={error} title="The reviews could not be loaded" onRetry={refetch} />
      </div>
    );
  } else if (!localReviews.length) {
    body = (
      <EmptyState
        icon={MdRateReview}
        title="No reviews yet"
        hint="Upload a screenshot of a customer review — a Facebook recommendation, a message, a comment — and it appears in the homepage carousel."
        action={addButton}
      />
    );
  } else {
    body = (
      <ol className="divide-y divide-slate-100">
        {localReviews.map((review, i) => {
          const name = review.name || `Review ${i + 1}`;
          const isDropTarget = dragOverIdx === i && dragIdx !== null && dragIdx !== i;
          return (
            <li
              key={review.id}
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

              {/* Square, matching the storefront card frame */}
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 sm:h-20 sm:w-20">
                {review.image?.path ? (
                  <Image src={review.image.path} alt={review.alt || name} fill className={`object-contain ${review.isActive ? '' : 'opacity-50 grayscale'}`} />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <MdImage size={22} aria-hidden />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${review.name ? 'text-slate-900' : 'text-slate-500'}`}>{name}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                  <MdLink size={14} className="shrink-0" aria-hidden />
                  <span className="truncate">{review.link || 'No link'}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`hidden text-[13px] md:inline ${review.isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                  {review.isActive ? (
                    'Showing'
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <MdVisibilityOff size={14} aria-hidden /> Hidden
                    </span>
                  )}
                </span>
                <Switch checked={review.isActive} onChange={() => handleToggleActive(review)} label={`Show ${name}'s review on the homepage`} />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setModal({ mode: 'edit', review })} className="btn-ghost btn-sm">
                  Edit
                </button>
                <ActionMenu
                  label={`More actions for ${name}`}
                  items={[
                    { label: 'Move up', icon: MdArrowUpward, onClick: () => move(i, i - 1), disabled: i === 0 },
                    { label: 'Move down', icon: MdArrowDownward, onClick: () => move(i, i + 1), disabled: i === localReviews.length - 1 },
                    { label: 'Delete', icon: MdDelete, tone: 'danger', onClick: () => handleDelete(review, i) }
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
              setDragOverIdx(localReviews.length);
            }}
            onDrop={(e) => handleDrop(e, localReviews.length)}
            className={`m-3 flex h-12 items-center justify-center rounded-md border-2 border-dashed text-[13px] font-medium transition ${
              dragOverIdx === localReviews.length ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'
            }`}
          >
            Drop here to move to the end
          </li>
        )}
      </ol>
    );
  }

  return (
    <>
      <PageHeader title="Customer reviews">{addButton}</PageHeader>

      <Panel
        title="Review carousel"
        description={
          localReviews.length
            ? `${activeCount} showing${hiddenCount ? ` · ${hiddenCount} hidden` : ''}${localReviews.length > 1 ? ' · drag or use the menu to reorder' : ''}`
            : 'Screenshots of real customer reviews, shown in order on the homepage.'
        }
        bodyClassName="!p-0"
      >
        <div className="mt-4 border-t border-slate-100">{body}</div>
      </Panel>

      {modal && <ReviewDrawer mode={modal.mode} review={modal.review} onClose={() => setModal(null)} onSaved={refresh} />}
    </>
  );
}
