'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { MdDragIndicator } from 'react-icons/md';
import { FiEdit2, FiTrash2, FiPlus, FiImage, FiX, FiLink, FiEyeOff, FiCheck, FiAlertTriangle, FiUser } from 'react-icons/fi';
import * as api from 'src/services';
import Image from 'next/image';
import PageHeader from 'src/components/_admin/ui/PageHeader';

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

export default function HomeReviewList() {
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const [localReviews, setLocalReviews] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const { isLoading } = useQuery('admin-home-reviews', api.getHomeReviewsAdmin, {
    onSuccess: (d) => setLocalReviews(d?.data || []),
    onError: () => showToast('Failed to load reviews', 'error')
  });

  // ── Modal ──────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModal({ mode: 'add' });
  };
  const openEdit = (review) => {
    setForm({
      name: review.name || '',
      link: review.link || '',
      alt: review.alt || '',
      isActive: review.isActive !== false,
      imageId: review.image?.id || null,
      imagePath: review.image?.path || null
    });
    setModal({ mode: 'edit', review });
  };
  const closeModal = () => {
    setModal(null);
    setForm(EMPTY_FORM);
  };

  // ── Image upload ───────────────────────────────────────────────────────────

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
    } catch (err) {
      showToast(err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.imageId) return showToast('Please upload the review screenshot', 'error');
    if (!form.name.trim()) return showToast('Please enter the reviewer name', 'error');
    setSaving(true);
    try {
      const payload = {
        image: form.imageId,
        name: form.name.trim(),
        link: form.link,
        alt: form.alt,
        isActive: form.isActive
      };
      if (modal.mode === 'add') {
        await api.createHomeReview(payload);
        showToast('Review added');
      } else {
        await api.updateHomeReview(modal.review.id, payload);
        showToast('Review updated');
      }
      closeModal();
      qc.invalidateQueries('admin-home-reviews');
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Active toggle ──────────────────────────────────────────────────────────

  const handleToggleActive = async (review) => {
    const next = !review.isActive;
    setLocalReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, isActive: next } : r)));
    try {
      await api.updateHomeReview(review.id, { isActive: next });
    } catch {
      setLocalReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, isActive: review.isActive } : r)));
      showToast('Failed to update status', 'error');
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id) => {
    try {
      await api.deleteHomeReview(id);
      setDeleteConfirm(null);
      showToast('Review deleted');
      qc.invalidateQueries('admin-home-reviews');
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

    const reordered = [...localReviews];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalReviews(reordered);

    try {
      await api.reorderHomeReviews(reordered.map((r) => r.id));
    } catch {
      showToast('Failed to save new order', 'error');
      qc.invalidateQueries('admin-home-reviews');
    }
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const activeCount = localReviews.filter((r) => r.isActive).length;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-44 bg-gray-200 rounded-md animate-pulse" />
            <div className="h-4 w-60 bg-gray-100 rounded-md animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded-md animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 bg-white border border-gray-200 rounded-md p-4">
            <div className="w-5 h-8 bg-gray-100 rounded-md animate-pulse" />
            <div className="w-7 h-7 bg-gray-100 rounded-md animate-pulse" />
            <div className="w-20 h-20 bg-gray-100 rounded-md animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-gray-100 rounded-md animate-pulse" />
              <div className="h-3 w-56 bg-gray-100 rounded-md animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-gray-100 rounded-md animate-pulse" />
              <div className="h-8 w-8 bg-gray-100 rounded-md animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Toast toast={toast} />

      {/* Header */}
      <PageHeader
        title="Customer Reviews"
        subtitle={
          <>
            {localReviews.length} review{localReviews.length !== 1 ? 's' : ''}
            {localReviews.length > 0 && (
              <>
                {' · '}
                <span className="font-medium text-emerald-600">{activeCount} active</span>
                {localReviews.length - activeCount > 0 && (
                  <>
                    {' '}
                    · <span className="text-slate-400">{localReviews.length - activeCount} hidden</span>
                  </>
                )}
                {localReviews.length > 1 && <> · drag ⠿ to reorder</>}
              </>
            )}
          </>
        }
      >
        <button onClick={openAdd} className="btn-brand active:scale-95">
          <FiPlus className="text-base" /> Add Review
        </button>
      </PageHeader>

      {/* Stats */}
      {localReviews.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: localReviews.length, color: 'text-gray-700', bg: 'bg-gray-50   border-gray-200' },
            { label: 'Active', value: activeCount, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            {
              label: 'Hidden',
              value: localReviews.length - activeCount,
              color: 'text-gray-400',
              bg: 'bg-gray-50   border-gray-200'
            }
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`border rounded-md px-4 py-3 ${bg}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {localReviews.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-md py-20 text-center bg-gray-50/50">
          <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center mx-auto mb-4">
            <FiImage className="text-gray-300 text-3xl" />
          </div>
          <p className="text-gray-600 font-semibold">No reviews yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Upload a screenshot of a customer review — a Facebook recommendation, a message, a comment — and it appears
            in the homepage carousel.
          </p>
          <button onClick={openAdd} className="btn-brand mt-5">
            <FiPlus /> Add Review
          </button>
        </div>
      )}

      {/* Review list */}
      {localReviews.length > 0 && (
        <div className="space-y-2">
          {localReviews.map((review, i) => (
            <div
              key={review.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`relative group flex items-center gap-4 bg-white border rounded-md px-4 py-3 transition-all select-none
                ${
                  dragIdx === i
                    ? 'opacity-30 scale-[0.98] border-dashed border-[var(--brand-ring)]'
                    : dragOverIdx === i && dragIdx !== null && dragIdx !== i
                      ? 'border-[var(--brand)] shadow-lg shadow-slate-100 ring-2 ring-[var(--brand-ring)]'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
            >
              {/* Drop indicator */}
              {dragOverIdx === i && dragIdx !== null && dragIdx !== i && (
                <div className="absolute -top-px left-6 right-6 h-0.5 bg-[var(--brand-soft)]0 rounded-md" />
              )}

              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-gray-300 group-hover:text-gray-400 transition shrink-0 touch-none py-2">
                <MdDragIndicator className="text-xl" />
              </div>

              {/* Order badge */}
              <div className="w-7 h-7 rounded-md bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>

              {/* Thumbnail — square, matching the storefront card frame */}
              <div className="relative w-20 h-20 rounded-md overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                {review.image?.path ? (
                  <Image
                    src={review.image.path}
                    alt={review.alt || `Review ${i + 1}`}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <FiImage className="text-gray-300 text-xl" />
                    <span className="text-gray-300 text-[10px]">No image</span>
                  </div>
                )}
                {!review.isActive && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <FiEyeOff className="text-white/80 text-sm" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-semibold text-sm truncate ${review.name ? 'text-gray-800' : 'text-gray-300 italic font-normal'}`}
                >
                  {review.name || 'No name'}
                </p>
                {review.link ? (
                  <p className="text-xs text-[var(--brand-strong)] truncate flex items-center gap-1 mt-1">
                    <FiLink className="shrink-0 text-[10px]" />
                    {review.link}
                  </p>
                ) : (
                  <p className="text-xs text-gray-300 mt-1 italic">No link set</p>
                )}
              </div>

              {/* Status toggle */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 w-[90px]">
                <button
                  onClick={() => handleToggleActive(review)}
                  className={`relative w-10 h-5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    review.isActive ? 'bg-emerald-500 focus:ring-emerald-300' : 'bg-gray-300 focus:ring-gray-200'
                  }`}
                  title={review.isActive ? 'Click to hide' : 'Click to show'}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-md shadow transition-transform ${review.isActive ? 'translate-x-5' : ''}`}
                  />
                </button>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${review.isActive ? 'text-emerald-600' : 'text-gray-400'}`}
                >
                  {review.isActive ? 'Active' : 'Hidden'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(review)}
                  className="p-2 rounded-md hover:bg-[var(--brand-soft)] text-gray-400 hover:text-[var(--brand-strong)] transition"
                  title="Edit"
                >
                  <FiEdit2 className="text-sm" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(review.id)}
                  className="p-2 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                  title="Delete"
                >
                  <FiTrash2 className="text-sm" />
                </button>
              </div>

              {/* Inline delete confirm */}
              {deleteConfirm === review.id && (
                <div className="absolute inset-0 bg-white/96 backdrop-blur-[2px] rounded-md flex items-center justify-center gap-3 z-20 border border-red-200">
                  <FiAlertTriangle className="text-red-400 text-lg shrink-0" />
                  <span className="text-sm font-medium text-gray-700">Delete this review?</span>
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Drop zone at end */}
          {dragIdx !== null && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(localReviews.length);
              }}
              onDrop={(e) => handleDrop(e, localReviews.length)}
              className={`h-14 rounded-md border-2 border-dashed flex items-center justify-center text-sm font-medium transition-all
                ${
                  dragOverIdx === localReviews.length
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]'
                    : 'border-gray-200 text-gray-300'
                }`}
            >
              Drop here to move to end
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-md shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {modal.mode === 'add' ? 'Add Customer Review' : 'Edit Customer Review'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modal.mode === 'add'
                    ? 'Upload the review screenshot and name the customer who wrote it.'
                    : 'Update this review. Leave image unchanged to keep the current one.'}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {/* Image upload area */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-2">
                  Review Screenshot <span className="text-red-400">*</span>
                </label>

                {form.imagePath ? (
                  <div
                    className="relative rounded-md overflow-hidden bg-gray-100 border border-gray-200"
                    style={{ paddingTop: '100%' }}
                  >
                    <Image src={form.imagePath} alt="preview" fill className="object-contain" />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="absolute inset-0 bg-black/0 hover:bg-black/40 transition flex items-center justify-center opacity-0 hover:opacity-100"
                    >
                      <span className="bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow">
                        <FiImage className="text-sm" /> Change Image
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-gray-200 hover:border-[var(--brand)] rounded-md py-10 text-center transition-all group bg-gray-50 hover:bg-[var(--brand-soft)]/30 disabled:opacity-70"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2 text-[var(--brand-strong)]">
                        <svg className="animate-spin h-7 w-7" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Uploading…</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-gray-100 group-hover:bg-[var(--brand-soft)] rounded-md flex items-center justify-center mx-auto mb-3 transition">
                          <FiImage className="text-gray-400 group-hover:text-[var(--brand-strong)] text-2xl transition" />
                        </div>
                        <p className="text-sm font-semibold text-gray-600 group-hover:text-[var(--brand-strong)] transition">
                          Click to upload
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PNG, JPG, WEBP · square works best — any shape fits, nothing is cropped
                        </p>
                      </>
                    )}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              {/* Text fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    <FiUser className="inline mr-1 text-[11px]" /> Customer Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Farhana Akter"
                    className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-transparent placeholder-gray-300"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Printed on the card, under the screenshot.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    <FiLink className="inline mr-1 text-[11px]" /> Link URL
                  </label>
                  <input
                    value={form.link}
                    onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                    placeholder="Facebook post permalink, or leave empty"
                    className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-transparent placeholder-gray-300"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Clicking the card opens this — link the original post so shoppers can verify it.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Alt Text (SEO)</label>
                  <input
                    value={form.alt}
                    onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))}
                    placeholder="Describe the screenshot for accessibility"
                    className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] focus:border-transparent placeholder-gray-300"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Show on homepage</p>
                  <p className="text-xs text-gray-400 mt-0.5">Only active reviews appear in the carousel</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${form.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {form.isActive ? 'Active' : 'Hidden'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    className={`relative w-12 h-6 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      form.isActive ? 'bg-emerald-500 focus:ring-emerald-300' : 'bg-gray-300 focus:ring-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-md shadow transition-transform ${form.isActive ? 'translate-x-6' : ''}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-gray-50/80 rounded-b-md shrink-0">
              <p className="text-xs text-red-400">
                {!form.imageId ? 'Screenshot is required' : !form.name.trim() ? 'Customer name is required' : ''}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.imageId || !form.name.trim() || uploading}
                  className="btn-brand px-5"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Saving…
                    </>
                  ) : modal.mode === 'add' ? (
                    'Add Review'
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
