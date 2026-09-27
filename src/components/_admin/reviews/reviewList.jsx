'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Image from 'next/image';
import { MdArrowBack, MdArrowForward, MdDelete, MdDragIndicator, MdImage, MdOutlineFileUpload } from 'react-icons/md';
import * as api from 'src/services';
import { alertError, alertWarning, confirmDelete, toastSuccess } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { Switch } from 'src/components/_admin/ui/fields';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';

// Reviews are image-only — the uploaded picture IS the review, so there is no
// title/subtitle here. The storefront crops to a square, which is why the
// uploader nudges toward square source images.

export default function ReviewList() {
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const [reviews, setReviews] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { isLoading, isError, error, refetch } = useQuery('admin-home-reviews', api.getHomeReviewsAdmin, {
    onSuccess: (d) => setReviews(d?.data || [])
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
    if (failed) alertWarning(`${failed} of ${files.length} images were not added`, 'Try those images again.');
    else toastSuccess(`${files.length} review${files.length > 1 ? 's' : ''} added`);
  };

  // ── Row actions ────────────────────────────────────────────────────────────

  const handleToggle = async (review) => {
    const next = !review.isActive;
    setReviews((rs) => rs.map((r) => (r.id === review.id ? { ...r, isActive: next } : r)));
    try {
      await api.updateHomeReview(review.id, { isActive: next });
    } catch (err) {
      alertError(err, { title: next ? 'The review was not shown' : 'The review was not hidden' });
      refresh();
    }
  };

  const handleDelete = async (review, i) => {
    const confirmed = await confirmDelete({
      title: 'Delete this review?',
      subject: `Review ${i + 1}`,
      text: 'The image is removed from the homepage carousel.'
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

  // ── Reorder (drag, or Move earlier / later from the card menu) ────────────

  const move = async (from, to) => {
    if (from === null || to === null || from === to || to < 0 || to >= reviews.length) return;
    const next = [...reviews];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setReviews(next);
    try {
      await api.reorderHomeReviews(next.map((r) => r.id));
    } catch (err) {
      alertError(err, { title: 'The new order was not saved' });
      refresh();
    }
  };

  const handleDrop = () => {
    const from = dragIdx;
    const to = dragOverIdx;
    setDragIdx(null);
    setDragOverIdx(null);
    move(from, to);
  };

  const pick = () => fileRef.current?.click();
  const uploadButton = (
    <button type="button" onClick={pick} disabled={uploading} className="btn-brand">
      <MdOutlineFileUpload size={18} aria-hidden /> {uploading ? 'Uploading…' : 'Upload reviews'}
    </button>
  );
  const showing = reviews.filter((r) => r.isActive).length;

  let body;
  if (isLoading && reviews.length === 0) {
    body = (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card-ui aspect-square animate-pulse" />
        ))}
      </div>
    );
  } else if (isError && reviews.length === 0) {
    body = <ErrorState error={error} title="The reviews could not be loaded" onRetry={refetch} />;
  } else if (reviews.length === 0) {
    body = (
      <div className="card-ui">
        <EmptyState
          icon={MdImage}
          title="No reviews yet"
          hint="Upload square screenshots of customer reviews. You can choose several at once."
          action={uploadButton}
        />
      </div>
    );
  } else {
    body = (
      <>
        <p className="text-[13px] text-slate-500">
          {showing} of {reviews.length} showing{reviews.length > 1 ? ' · drag a card or use its menu to reorder' : ''}
        </p>
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {reviews.map((review, i) => (
            <li
              key={review.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(i);
              }}
              onDrop={handleDrop}
              onDragEnd={() => {
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              className={`card-ui overflow-hidden transition ${
                dragOverIdx === i && dragIdx !== null && dragIdx !== i ? 'ring-2 ring-slate-900' : ''
              } ${dragIdx === i ? 'opacity-40' : ''}`}
            >
              {/* Square frame, matching how the storefront crops it */}
              <div className="relative aspect-square cursor-grab bg-slate-50 active:cursor-grabbing">
                {review.image?.path ? (
                  <Image
                    src={review.image.path}
                    alt={review.alt || `Review ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 20vw"
                    className={`object-cover ${review.isActive ? '' : 'opacity-50 grayscale'}`}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-slate-400">
                    <MdImage size={28} aria-hidden />
                  </span>
                )}
                <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-900 shadow-sm">
                  <MdDragIndicator size={13} aria-hidden /> {i + 1}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Switch checked={review.isActive} onChange={() => handleToggle(review)} label={`Show review ${i + 1} on the homepage`} />
                  <span className="text-xs text-slate-600">{review.isActive ? 'Showing' : 'Hidden'}</span>
                </div>
                <ActionMenu
                  label={`More actions for review ${i + 1}`}
                  items={[
                    { label: 'Move earlier', icon: MdArrowBack, onClick: () => move(i, i - 1), disabled: i === 0 },
                    { label: 'Move later', icon: MdArrowForward, onClick: () => move(i, i + 1), disabled: i === reviews.length - 1 },
                    { label: 'Delete', icon: MdDelete, tone: 'danger', onClick: () => handleDelete(review, i) }
                  ]}
                />
              </div>
            </li>
          ))}
        </ol>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" subtitle="Square images shown in the homepage reviews carousel.">
        {uploadButton}
      </PageHeader>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} tabIndex={-1} aria-hidden />

      {body}
    </div>
  );
}
