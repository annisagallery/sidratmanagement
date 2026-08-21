'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { FiImage, FiLink, FiCheck, FiAlertTriangle, FiTrash2 } from 'react-icons/fi';
import Image from 'next/image';
import * as api from 'src/services';

// Which hero row the storefront homepage draws, plus the two notice tiles the
// "banner with notice" layout uses. This sits above the banner list because it
// decides what that list is even shown inside.

const LAYOUTS = [
  {
    value: 'categories',
    title: 'Banner with categories',
    blurb: 'The category list runs down the left, banner on the right.',
    art: (
      <>
        <span className="h-full w-1/4 rounded-[2px] bg-slate-300" />
        <span className="h-full flex-1 rounded-[2px] bg-slate-400" />
      </>
    )
  },
  {
    value: 'notice',
    title: 'Banner with notices',
    blurb: 'Banner on the left, two square notice tiles stacked on the right.',
    art: (
      <>
        <span className="h-full flex-1 rounded-[2px] bg-slate-400" />
        <span className="flex h-full w-1/5 flex-col gap-1">
          <span className="flex-1 rounded-[2px] bg-slate-300" />
          <span className="flex-1 rounded-[2px] bg-slate-300" />
        </span>
      </>
    )
  },
  {
    value: 'bannerOnly',
    title: 'Banner only',
    blurb: 'The banner runs the full width of the page.',
    art: <span className="h-full flex-1 rounded-[2px] bg-slate-400" />
  }
];

const SLOT_HELP = {
  1: 'Leave empty to show today’s date in English, Bengali and Arabic.',
  2: 'Leave empty to show whether the showrooms are open today, linked to the branch page.'
};

function NoticeSlot({ slot, notice, onToast }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState(notice?.link || '');
  const [alt, setAlt] = useState(notice?.alt || '');
  const [loadedId, setLoadedId] = useState(notice?.id);

  // The slot arrives from a query that resolves after first paint, so the
  // inputs have to adopt its values when it lands. Adjusting during render
  // (the same pattern as components/safeImage) rather than in an effect keeps
  // it to one render and never stomps on what the admin is currently typing —
  // only a genuinely different slot record resets the fields.
  if (notice?.id !== loadedId) {
    setLoadedId(notice?.id);
    setLink(notice?.link || '');
    setAlt(notice?.alt || '');
  }

  const imagePath = notice?.image?.path || null;

  const save = async (imageId) => {
    setSaving(true);
    try {
      await api.saveHomeNotice(slot, { image: imageId ?? notice?.image?.id ?? null, link, alt, isActive: true });
      onToast(`Notice ${slot} saved`);
      qc.invalidateQueries('admin-home-notices');
    } catch (err) {
      onToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'HomeNotice');
      const res = await api.uploadImage(fd);
      await save(res.id);
    } catch (err) {
      onToast(err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const clear = async () => {
    try {
      await api.clearHomeNotice(slot);
      onToast(`Notice ${slot} cleared`);
      qc.invalidateQueries('admin-home-notices');
    } catch (err) {
      onToast(err.response?.data?.message || 'Could not clear', 'error');
    }
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">Notice {slot}</p>
        {imagePath && (
          <button
            onClick={clear}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-400 transition hover:bg-red-50 hover:text-red-500"
          >
            <FiTrash2 className="text-xs" /> Clear
          </button>
        )}
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || saving}
          className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md border-2 border-dashed border-gray-200 bg-gray-50 transition hover:border-[var(--brand)] disabled:opacity-70"
        >
          {imagePath ? (
            <Image src={imagePath} alt={alt || `Notice ${slot}`} fill className="object-cover" />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
              <FiImage className="text-xl" />
              <span className="text-[10px] font-semibold">{uploading ? 'Uploading…' : 'Upload square'}</span>
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs leading-relaxed text-gray-400">{SLOT_HELP[slot]}</p>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-600">
              <FiLink className="mr-1 inline text-[10px]" /> Link
            </label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => imagePath && save()}
              placeholder="/products or https://…"
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs placeholder-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-600">Alt text</label>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              onBlur={() => imagePath && save()}
              placeholder="Describe the notice"
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs placeholder-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroLayoutPicker() {
  const qc = useQueryClient();
  const [toast, setToast] = useState(null);
  const [savingLayout, setSavingLayout] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const { data: settings } = useQuery('admin-site-settings-hero', api.getSiteSettingsByAdmin);
  const { data: notices } = useQuery('admin-home-notices', api.getHomeNoticesAdmin);

  const layout = settings?.data?.homeHeroLayout || 'categories';
  const bySlot = new Map((notices?.data || []).map((n) => [n.slot, n]));

  const pick = async (value) => {
    if (value === layout) return;
    setSavingLayout(value);
    try {
      await api.updateSiteSettings({ homeHeroLayout: value });
      showToast('Homepage layout updated');
      qc.invalidateQueries('admin-site-settings-hero');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not change layout', 'error');
    } finally {
      setSavingLayout(null);
    }
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={`fixed right-5 top-5 z-[100] flex items-center gap-2.5 rounded-md border px-4 py-3 text-sm font-medium shadow-lg
          ${
            toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {toast.type === 'error' ? <FiAlertTriangle className="shrink-0" /> : <FiCheck className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Homepage hero</h2>
        <p className="mt-0.5 text-xs text-gray-400">What sits beside the banner at the top of the storefront.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {LAYOUTS.map((option) => {
          const active = layout === option.value;
          return (
            <button
              key={option.value}
              onClick={() => pick(option.value)}
              disabled={Boolean(savingLayout)}
              className={`rounded-md border p-3 text-left transition disabled:opacity-60 ${
                active
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand-ring)]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="mb-2.5 flex h-12 gap-1 rounded-[3px] bg-slate-100 p-1">{option.art}</span>
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-800">{option.title}</span>
                {active && <FiCheck className="text-[var(--brand-strong)]" />}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-gray-400">{option.blurb}</span>
            </button>
          );
        })}
      </div>

      {layout === 'notice' && (
        <div className="grid gap-3 md:grid-cols-2">
          <NoticeSlot slot={1} notice={bySlot.get(1)} onToast={showToast} />
          <NoticeSlot slot={2} notice={bySlot.get(2)} onToast={showToast} />
        </div>
      )}
    </div>
  );
}
