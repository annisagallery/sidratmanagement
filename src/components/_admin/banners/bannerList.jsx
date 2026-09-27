'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Image from 'next/image';
import { MdAdd, MdArrowDownward, MdArrowUpward, MdDelete, MdDragIndicator, MdImage, MdLink, MdVisibilityOff } from 'react-icons/md';
import * as api from 'src/services';
import { toastSuccess, alertError, confirmDelete } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Drawer from 'src/components/_admin/ui/Drawer';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { Field, Switch, Toggle } from 'src/components/_admin/ui/fields';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  link: '',
  alt: '',
  isActive: true,
  imageId: null,
  imagePath: null
};

/** Add or edit one banner. Owns its form; the list only hears "saved". */
function BannerDrawer({ mode, banner, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState(() =>
    banner
      ? {
          title: banner.title || '',
          subtitle: banner.subtitle || '',
          link: banner.link || '',
          alt: banner.alt || '',
          isActive: banner.isActive !== false,
          imageId: banner.image?.id || null,
          imagePath: banner.image?.path || null
        }
      : EMPTY_FORM
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'HomeBanner');
      const res = await api.uploadImage(fd);
      setForm((f) => ({ ...f, imageId: res.id, imagePath: res.path }));
      setImageError('');
    } catch (err) {
      alertError(err, { title: 'The image was not uploaded' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.imageId) {
      setImageError('Upload the banner image.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        image: form.imageId,
        title: form.title,
        subtitle: form.subtitle,
        link: form.link,
        alt: form.alt,
        isActive: form.isActive
      };
      if (mode === 'add') {
        await api.createHomeBanner(payload);
        toastSuccess('Banner added');
      } else {
        await api.updateHomeBanner(banner.id, payload);
        toastSuccess('Banner saved');
      }
      onSaved();
      onClose();
    } catch (err) {
      alertError(err, { title: mode === 'add' ? 'The banner was not added' : 'The banner was not saved' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={mode === 'add' ? 'Add banner' : 'Edit banner'}
      eyebrow="Homepage"
      onClose={onClose}
      onSubmit={handleSave}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving || uploading} className="btn-brand">
            {saving ? 'Saving…' : mode === 'add' ? 'Add banner' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-slate-800">
            Image
            <span className="ml-0.5 text-rose-600" aria-hidden>
              *
            </span>
          </p>
          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {form.imagePath ? (
              <Image src={form.imagePath} alt="Banner preview" fill className="object-cover" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[13px] text-slate-500">
                <MdImage size={26} className="text-slate-400" aria-hidden />
                {uploading ? 'Uploading…' : 'No image yet'}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-slate-500">PNG, JPG or WEBP. Wide images (3:1 or 21:9) fit best.</p>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-ghost btn-sm">
              {uploading ? 'Uploading…' : form.imagePath ? 'Replace image' : 'Upload image'}
            </button>
          </div>
          {imageError && (
            <p className="mt-1.5 text-[13px] font-medium text-rose-700" role="alert">
              {imageError}
            </p>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} tabIndex={-1} aria-hidden />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" optional>
            <input value={form.title} onChange={set('title')} placeholder="e.g. Summer collection" className="input-ui" />
          </Field>
          <Field label="Subtitle" optional>
            <input value={form.subtitle} onChange={set('subtitle')} placeholder="A short tagline" className="input-ui" />
          </Field>
          <Field label="Link" optional help="Where a tap on the banner goes." className="sm:col-span-2">
            <input value={form.link} onChange={set('link')} placeholder="/products or https://…" className="input-ui" />
          </Field>
          <Field label="Image description" optional help="Read aloud by screen readers and used by search engines." className="sm:col-span-2">
            <input value={form.alt} onChange={set('alt')} placeholder="Describe what the image shows" className="input-ui" />
          </Field>
        </div>

        <Toggle
          label="Show on the homepage"
          help="Only banners that are on appear in the carousel."
          checked={form.isActive}
          onChange={(on) => setForm((f) => ({ ...f, isActive: on }))}
        />
      </div>
    </Drawer>
  );
}

export default function BannerList() {
  const qc = useQueryClient();

  const [localBanners, setLocalBanners] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [modal, setModal] = useState(null);

  const { isLoading, isError, error, refetch } = useQuery('admin-banners', api.getHomeBannersAdmin, {
    onSuccess: (d) => setLocalBanners(d?.data || [])
  });

  const refresh = () => qc.invalidateQueries('admin-banners');

  // ── Active toggle ──────────────────────────────────────────────────────────

  const handleToggleActive = async (banner) => {
    const next = !banner.isActive;
    setLocalBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, isActive: next } : b)));
    try {
      await api.updateHomeBanner(banner.id, { isActive: next });
    } catch (err) {
      setLocalBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, isActive: banner.isActive } : b)));
      alertError(err, { title: next ? 'The banner was not shown' : 'The banner was not hidden' });
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (banner, i) => {
    const confirmed = await confirmDelete({
      title: 'Delete this banner?',
      subject: banner.title || `Banner ${i + 1}`,
      text: 'It is removed from the homepage carousel.'
    });
    if (!confirmed) return;
    try {
      await api.deleteHomeBanner(banner.id);
      toastSuccess('Banner deleted');
      refresh();
    } catch (err) {
      alertError(err, { title: 'The banner was not deleted' });
    }
  };

  // ── Reorder (drag, or Move up / Move down from the row menu) ──────────────

  const move = async (fromIdx, toIdx) => {
    if (fromIdx === null || fromIdx === toIdx || toIdx < 0 || toIdx > localBanners.length) return;
    const reordered = [...localBanners];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalBanners(reordered);
    try {
      await api.reorderHomeBanners(reordered.map((b) => b.id));
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

  const activeCount = localBanners.filter((b) => b.isActive).length;
  const hiddenCount = localBanners.length - activeCount;
  const addButton = (
    <button type="button" onClick={() => setModal({ mode: 'add' })} className="btn-brand">
      <MdAdd size={18} aria-hidden /> Add banner
    </button>
  );

  let body;
  if (isLoading) {
    body = (
      <ul className="divide-y divide-slate-100" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="skeleton h-20 w-36 shrink-0" />
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
        <ErrorState error={error} title="The banners could not be loaded" onRetry={refetch} />
      </div>
    );
  } else if (!localBanners.length) {
    body = (
      <EmptyState
        icon={MdImage}
        title="No banners yet"
        hint="Banners you add here rotate in the homepage carousel."
        action={addButton}
      />
    );
  } else {
    body = (
      <ol className="divide-y divide-slate-100">
        {localBanners.map((banner, i) => {
          const name = banner.title || `Banner ${i + 1}`;
          const isDropTarget = dragOverIdx === i && dragIdx !== null && dragIdx !== i;
          return (
            <li
              key={banner.id}
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

              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 sm:h-20 sm:w-36">
                {banner.image?.path ? (
                  <Image src={banner.image.path} alt={banner.alt || name} fill className={`object-cover ${banner.isActive ? '' : 'opacity-50 grayscale'}`} />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <MdImage size={22} aria-hidden />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${banner.title ? 'text-slate-900' : 'text-slate-500'}`}>{name}</p>
                {banner.subtitle && <p className="mt-0.5 truncate text-[13px] text-slate-600">{banner.subtitle}</p>}
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                  <MdLink size={14} className="shrink-0" aria-hidden />
                  <span className="truncate">{banner.link || 'No link'}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`hidden text-[13px] md:inline ${banner.isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                  {banner.isActive ? 'Showing' : (
                    <span className="inline-flex items-center gap-1">
                      <MdVisibilityOff size={14} aria-hidden /> Hidden
                    </span>
                  )}
                </span>
                <Switch
                  checked={banner.isActive}
                  onChange={() => handleToggleActive(banner)}
                  label={`Show ${name} on the homepage`}
                />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setModal({ mode: 'edit', banner })} className="btn-ghost btn-sm">
                  Edit
                </button>
                <ActionMenu
                  label={`More actions for ${name}`}
                  items={[
                    { label: 'Move up', icon: MdArrowUpward, onClick: () => move(i, i - 1), disabled: i === 0 },
                    { label: 'Move down', icon: MdArrowDownward, onClick: () => move(i, i + 1), disabled: i === localBanners.length - 1 },
                    { label: 'Delete', icon: MdDelete, tone: 'danger', onClick: () => handleDelete(banner, i) }
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
              setDragOverIdx(localBanners.length);
            }}
            onDrop={(e) => handleDrop(e, localBanners.length)}
            className={`m-3 flex h-12 items-center justify-center rounded-md border-2 border-dashed text-[13px] font-medium transition ${
              dragOverIdx === localBanners.length ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'
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
      <PageHeader title="Banners">{addButton}</PageHeader>

      <Panel
        title="Carousel banners"
        description={
          localBanners.length
            ? `${activeCount} showing${hiddenCount ? ` · ${hiddenCount} hidden` : ''}${localBanners.length > 1 ? ' · drag or use the menu to reorder' : ''}`
            : 'Shown in order on the homepage.'
        }
        bodyClassName="!p-0"
      >
        <div className="mt-4 border-t border-slate-100">{body}</div>
      </Panel>

      {modal && <BannerDrawer mode={modal.mode} banner={modal.banner} onClose={() => setModal(null)} onSaved={refresh} />}
    </>
  );
}
