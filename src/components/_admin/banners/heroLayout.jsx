'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import Image from 'next/image';
import { MdCheckCircle, MdImage } from 'react-icons/md';
import * as api from 'src/services';
import { toastSuccess, alertError } from 'src/utils/swal';
import Panel from 'src/components/_admin/ui/Panel';
import { Field } from 'src/components/_admin/ui/fields';
import { ErrorState } from 'src/components/_admin/ui/TableStates';

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

function NoticeSlot({ slot, notice }) {
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
      toastSuccess(`Notice ${slot} saved`);
      qc.invalidateQueries('admin-home-notices');
    } catch (err) {
      alertError(err, { title: `Notice ${slot} was not saved` });
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
      alertError(err, { title: 'The image was not uploaded' });
    } finally {
      setUploading(false);
    }
  };

  const clear = async () => {
    try {
      await api.clearHomeNotice(slot);
      toastSuccess(`Notice ${slot} cleared`);
      qc.invalidateQueries('admin-home-notices');
    } catch (err) {
      alertError(err, { title: `Notice ${slot} was not cleared` });
    }
  };

  const busy = uploading || saving;

  return (
    <section className="rounded-lg border border-slate-200 p-4" aria-labelledby={`notice-${slot}-title`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id={`notice-${slot}-title`} className="text-sm font-semibold text-slate-900">
          Notice {slot}
        </h3>
        <div className="flex items-center gap-2">
          {busy && (
            <span className="text-xs text-slate-500" role="status">
              {uploading ? 'Uploading…' : 'Saving…'}
            </span>
          )}
          {imagePath && (
            <button type="button" onClick={clear} disabled={busy} className="btn-ghost btn-sm hover:text-rose-700">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0 space-y-2">
          <div className="relative h-28 w-28 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {imagePath ? (
              <Image src={imagePath} alt={alt || `Notice ${slot}`} fill className="object-cover" />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-slate-500">
                <MdImage size={22} className="text-slate-400" aria-hidden />
                Square image
              </span>
            )}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost btn-sm w-28">
            {imagePath ? 'Replace' : 'Upload'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} tabIndex={-1} aria-hidden />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[13px] leading-relaxed text-slate-500">{SLOT_HELP[slot]}</p>
          <Field label="Link" optional>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => imagePath && link !== (notice?.link || '') && save()}
              placeholder="/products or https://…"
              className="input-ui"
            />
          </Field>
          <Field label="Image description" optional help="Read aloud by screen readers.">
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              onBlur={() => imagePath && alt !== (notice?.alt || '') && save()}
              placeholder="Describe the notice"
              className="input-ui"
            />
          </Field>
        </div>
      </div>
    </section>
  );
}

export default function HeroLayoutPicker() {
  const qc = useQueryClient();
  const [savingLayout, setSavingLayout] = useState(null);

  const { data: settings, isLoading, isError, error, refetch } = useQuery('admin-site-settings-hero', api.getSiteSettingsByAdmin);
  const { data: notices } = useQuery('admin-home-notices', api.getHomeNoticesAdmin);

  const layout = settings?.data?.homeHeroLayout || 'categories';
  const bySlot = new Map((notices?.data || []).map((n) => [n.slot, n]));

  const pick = async (value) => {
    if (value === layout) return;
    setSavingLayout(value);
    try {
      await api.updateSiteSettings({ homeHeroLayout: value });
      toastSuccess('Homepage layout changed');
      qc.invalidateQueries('admin-site-settings-hero');
    } catch (err) {
      alertError(err, { title: 'The layout was not changed' });
    } finally {
      setSavingLayout(null);
    }
  };

  return (
    <Panel title="Hero layout" description="What sits beside the banner at the top of the storefront.">
      {isError ? (
        <ErrorState error={error} title="The current layout could not be loaded" onRetry={refetch} />
      ) : (
      <div className="space-y-5">
        <div role="radiogroup" aria-label="Hero layout" className="grid gap-3 sm:grid-cols-3">
          {LAYOUTS.map((option) => {
            const active = layout === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick(option.value)}
                disabled={Boolean(savingLayout) || isLoading}
                className={`rounded-lg border p-3 text-left transition disabled:cursor-wait ${
                  active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="mb-3 flex h-12 gap-1 rounded-[3px] bg-slate-100 p-1" aria-hidden>
                  {option.art}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{option.title}</span>
                  {active && <MdCheckCircle size={17} className="shrink-0 text-slate-900" aria-hidden />}
                  {savingLayout === option.value && <span className="text-xs text-slate-500">Saving…</span>}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{option.blurb}</span>
              </button>
            );
          })}
        </div>

        {layout === 'notice' && (
          <div className="grid gap-4 md:grid-cols-2">
            <NoticeSlot slot={1} notice={bySlot.get(1)} />
            <NoticeSlot slot={2} notice={bySlot.get(2)} />
          </div>
        )}
      </div>
      )}
    </Panel>
  );
}
