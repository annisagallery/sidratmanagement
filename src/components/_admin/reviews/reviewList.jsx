'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { MdDragIndicator } from 'react-icons/md';
import { FiTrash2, FiPlus, FiImage, FiX, FiEye, FiEyeOff, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import Image from 'next/image';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';

// Reviews are image-only — the uploaded picture IS the review, so there is no
// title/subtitle here. The storefront crops to a square, which is why the
// uploader nudges toward square source images.

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

export default function ReviewList() {
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const [reviews, setReviews] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const { isLoading } = useQuery('admin-home-reviews', api.getHomeReviewsAdmin, {
    onSuccess: (d) => setReviews(d?.data || []),
    onError: () => showToast('Failed to load reviews', 'error')
  });

  const refresh = () => qc.invalidateQueries('admin-home-reviews');

  // ── Upload ─────────────────────────────────────────────────────────────────
  // Multiple files at once: reviews arrive in batches, one-at-a-time is tedious.
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setUploading(true);
    let failed = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('model', 'HomeReview');
        const res = await api.uploadImage(fd);
        await api.createHomeReview({ image: res.id, alt: '', isActive: true });
      } catch {
        failed += 1;
      }
    }
    setUploading(false);
    refresh();
    if (failed) showToast(`${failed} of ${files.length} upload(s) failed`, 'error');
    else showToast(`${files.length} review${files.length > 1 ? 's' : ''} added`);
  };

  // ── Row actions ────────────────────────────────────────────────────────────

  const handleToggle = async (review) => {
    const next = !review.isActive;
    setReviews((rs) => rs.map((r) => (r.id === review.id ? { ...r, isActive: next } : r)));
    try {
      await api.updateHomeReview(review.id, { isActive: next });
    } catch {
      showToast('Failed to update', 'error');
      refresh();
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteHomeReview(id);
      setDeleteConfirm(null);
      showToast('Review deleted');
      refresh();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  // ── Drag to reorder ────────────────────────────────────────────────────────

  const handleDrop = async () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...reviews];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dragOverIdx, 0, moved);
    setReviews(next);
    setDragIdx(null);
    setDragOverIdx(null);
    try {
      await api.reorderHomeReviews(next.map((r) => r.id));
    } catch {
      showToast('Reorder failed', 'error');
      refresh();
    }
  };

  return (
    <div className="w-full space-y-4">
      <Toast toast={toast} />

      <PageHeader title="Reviews" subtitle="Square images shown in the homepage Reviews carousel. Drag to reorder.">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-brand px-4 py-2 text-sm disabled:opacity-50"
        >
          <FiPlus /> {uploading ? 'Uploading…' : 'Add Reviews'}
        </button>
      </PageHeader>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

      {isLoading && reviews.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-md hover:border-[var(--brand)] hover:text-[var(--brand-strong)] transition-colors"
        >
          <FiImage className="mx-auto mb-2 text-2xl" />
          <p className="text-sm font-medium">No reviews yet — upload square images</p>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {reviews.map((review, i) => (
            <div
              key={review.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(i);
              }}
              onDrop={handleDrop}
              onDragEnd={handleDrop}
              className={`group relative rounded-md border bg-white shadow-sm overflow-hidden cursor-grab active:cursor-grabbing transition-all
                ${dragOverIdx === i && dragIdx !== i ? 'ring-2 ring-[var(--brand-ring)]' : 'border-gray-200'}
                ${!review.isActive ? 'opacity-50' : ''}`}
            >
              {/* Square frame, matching how the storefront crops it */}
              <div className="relative aspect-square bg-gray-50">
                {review.image?.path ? (
                  <Image
                    src={review.image.path}
                    alt={review.alt || `Review ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 20vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">
                    <FiImage size={28} />
                  </div>
                )}

                <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  <MdDragIndicator size={12} /> {i + 1}
                </span>
              </div>

              <div className="flex items-center justify-between px-2 py-1.5">
                <button
                  onClick={() => handleToggle(review)}
                  title={review.isActive ? 'Visible — click to hide' : 'Hidden — click to show'}
                  className={`p-1.5 rounded-md transition-colors ${
                    review.isActive ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {review.isActive ? <FiEye size={15} /> : <FiEyeOff size={15} />}
                </button>
                <button
                  onClick={() => setDeleteConfirm(review.id)}
                  className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm space-y-4 rounded-md bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-gray-800">Delete review?</h3>
              <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600">
                <FiX />
              </button>
            </div>
            <p className="text-sm text-gray-500">This removes the image from the homepage carousel.</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-md border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-md bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
