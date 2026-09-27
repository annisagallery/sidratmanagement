'use client';
import { useState, useRef } from 'react';
import { useMutation } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import Image from 'next/image';
import { MdArrowBack, MdImage, MdOutlineFileUpload } from 'react-icons/md';
import { addCampaignByAdmin, updateCampaignByAdmin, uploadImage } from 'src/services';
import { toastSuccess, alertError } from 'src/utils/swal';
import CampaignProductPicker from 'src/components/_admin/campaigns/productPicker';
import CampaignBranchPicker from 'src/components/_admin/campaigns/branchPicker';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Segmented from 'src/components/_admin/ui/Segmented';
import { Field, LengthCounter } from 'src/components/_admin/ui/fields';

const TYPES = [
  { value: 'flash_sale', label: 'Flash sale' },
  { value: 'discount', label: 'Discount rule' },
  { value: 'seasonal', label: 'Seasonal event' },
  { value: 'announcement', label: 'Announcement' }
];

const DISCOUNT_TYPES = [
  { id: 'percent', label: 'Percentage (%)' },
  { id: 'fixed', label: 'Fixed amount (৳)' }
];

const STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' }
];

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fmt(d) {
  if (!d) return '';
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  return new Date(d).toISOString().slice(0, 16);
}

/** One uploadable image: preview (or a placeholder) and a replace button. */
function ImageSlot({ title, description, image, uploading, onPick }) {
  const ref = useRef();
  return (
    <Panel title={title} description={description}>
      <div className="space-y-3">
        {image?.path ? (
          <Image src={image.path} alt={`${title} preview`} width={1200} height={144} className="h-36 w-full rounded-md border border-slate-200 object-cover" />
        ) : (
          <div className="flex h-36 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 text-[13px] text-slate-500">
            <MdImage size={24} className="text-slate-400" aria-hidden />
            No image yet
          </div>
        )}
        <input type="file" accept="image/*" ref={ref} className="hidden" onChange={onPick} tabIndex={-1} aria-hidden />
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading} className="btn-ghost w-full">
          <MdOutlineFileUpload size={17} aria-hidden />
          {uploading ? 'Uploading…' : image?.path ? 'Replace image' : 'Upload image'}
        </button>
      </div>
    </Panel>
  );
}

export default function CampaignForm({ data: existing }) {
  const router = useRouter();
  const [imgLoading, setImgLoading] = useState(false);
  const [cardImgLoading, setCardImgLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const back = () => router.push('/campaigns');

  const [form, setForm] = useState({
    name: existing?.name || '',
    slug: existing?.slug || '',
    type: existing?.type || 'discount',
    description: existing?.description || '',
    metaTitle: existing?.metaTitle || '',
    metaDescription: existing?.metaDescription || '',
    cover: existing?.cover || null,
    cardImage: existing?.cardImage || null,
    discountType: existing?.discountType || 'percent',
    discount: existing?.discount || '',
    startDate: fmt(existing?.startDate) || '',
    endDate: fmt(existing?.endDate) || '',
    status: existing?.status || 'active',
    products: existing?.products || [],
    // Empty means "everywhere" — see CampaignBranchPicker.
    branches: (existing?.branches || []).map((b) => b.id ?? b)
  });

  const put = (k, v) => {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (k === 'name' && !existing) next.slug = toSlug(v);
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined, ...(k === 'name' ? { slug: undefined } : {}) }));
  };
  const set = (k) => (e) => put(k, e.target.value);

  // Image upload helpers
  const upload = (key, setBusy) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'campaigns');
      const res = await uploadImage(fd);
      setForm((p) => ({ ...p, [key]: { path: res.data?.path || res.path } }));
    } catch (err) {
      alertError(err, { title: 'The image was not uploaded' });
    } finally {
      setBusy(false);
    }
  };

  // Validation
  const validate = () => {
    const e = {};
    if (!form.name) e.name = 'Give the campaign a name.';
    if (!form.slug) e.slug = 'Enter the web address.';
    if (!form.discount) e.discount = 'Enter the discount.';
    else if (form.discountType === 'percent' && Number(form.discount) > 100) e.discount = 'A percentage cannot be more than 100.';
    if (!form.startDate) e.startDate = 'Choose when it starts.';
    if (!form.endDate) e.endDate = 'Choose when it ends.';
    else if (form.startDate && form.endDate <= form.startDate) e.endDate = 'The end must be after the start.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMut = useMutation(
    (payload) =>
      existing ? updateCampaignByAdmin({ currentSlug: existing.slug, ...payload }) : addCampaignByAdmin(payload),
    {
      onSuccess: (res) => {
        toastSuccess(res.message || (existing ? 'Campaign saved' : 'Campaign created'));
        back();
      },
      onError: (e) => alertError(e, { title: existing ? 'The campaign was not saved' : 'The campaign was not created' })
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    saveMut.mutate({ ...form, products: form.products.map((p) => p.id), branches: form.branches });
  };

  const saving = saveMut.isLoading;
  const submitLabel = saving ? 'Saving…' : existing ? 'Save changes' : 'Create campaign';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <PageHeader
        title={existing ? `Edit ${existing.name}` : 'New campaign'}
        subtitle={existing ? 'Changes reach the storefront and branches as soon as you save.' : 'A time-limited price for a set of products.'}
        eyebrow="Campaigns"
      >
        <button type="button" onClick={back} className="btn-ghost">
          <MdArrowBack size={17} aria-hidden /> Back to campaigns
        </button>
        <button type="submit" disabled={saving} className="btn-brand">
          {submitLabel}
        </button>
      </PageHeader>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: main info */}
        <div className="min-w-0 space-y-6">
          <Panel title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.name}>
                <input className="input-ui" value={form.name} onChange={set('name')} placeholder="e.g. Summer sale" autoFocus={!existing} />
              </Field>
              <Field label="Web address" required error={errors.slug} help={form.slug ? `/campaigns/${form.slug}` : 'Filled in from the name.'}>
                <input className="input-ui ops-code" value={form.slug} onChange={set('slug')} placeholder="summer-sale" spellCheck={false} />
              </Field>
              <Field label="Type">
                <select className="select-ui w-full" value={form.type} onChange={set('type')}>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <Segmented label="Status" options={STATUS_OPTIONS} value={form.status} onChange={(v) => put('status', v)} />
              </Field>
              <Field label="Description" optional className="sm:col-span-2">
                <textarea
                  className="input-ui min-h-[84px] resize-y py-2"
                  value={form.description}
                  onChange={set('description')}
                  rows={3}
                  placeholder="What shoppers see on the campaign page"
                />
              </Field>
            </div>
          </Panel>

          <CampaignProductPicker products={form.products} onChange={(products) => setForm((p) => ({ ...p, products }))} />

          <Panel title="Search engines" description="How the campaign page appears in search results.">
            <div className="space-y-4">
              <Field label="Page title" optional counter={<LengthCounter value={form.metaTitle} max={60} />}>
                <input className="input-ui" value={form.metaTitle} onChange={set('metaTitle')} placeholder={form.name || undefined} />
              </Field>
              <Field label="Description" optional counter={<LengthCounter value={form.metaDescription} max={160} />}>
                <textarea className="input-ui min-h-[64px] resize-y py-2" value={form.metaDescription} onChange={set('metaDescription')} rows={2} />
              </Field>
            </div>
          </Panel>
        </div>

        {/* Right: discount, dates, where it applies, images */}
        <div className="space-y-6">
          <Panel title="Discount">
            <div className="space-y-4">
              <Segmented
                label="Discount type"
                options={DISCOUNT_TYPES}
                value={form.discountType}
                onChange={(v) => put('discountType', v)}
                className="w-full [&>button]:flex-1 [&>button]:justify-center"
              />
              <Field
                label={form.discountType === 'percent' ? 'Percentage off' : 'Amount off (৳)'}
                required
                error={errors.discount}
                help={form.discountType === 'percent' ? 'Taken off the regular price.' : 'Taken off the regular price, in taka.'}
              >
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={form.discountType === 'percent' ? 100 : undefined}
                  className="input-ui tabular-nums"
                  value={form.discount}
                  onChange={set('discount')}
                  placeholder={form.discountType === 'percent' ? 'e.g. 20' : 'e.g. 100'}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Runs">
            <div className="space-y-4">
              <Field label="Starts" required error={errors.startDate}>
                <input type="datetime-local" className="input-ui" value={form.startDate} onChange={set('startDate')} />
              </Field>
              <Field label="Ends" required error={errors.endDate}>
                <input type="datetime-local" className="input-ui" value={form.endDate} onChange={set('endDate')} />
              </Field>
            </div>
          </Panel>

          <CampaignBranchPicker selected={form.branches} onChange={(branches) => setForm((p) => ({ ...p, branches }))} />

          <ImageSlot
            title="Cover image"
            description="The banner at the top of the campaign page."
            image={form.cover}
            uploading={imgLoading}
            onPick={upload('cover', setImgLoading)}
          />
          <ImageSlot
            title="Card image"
            description="Pinned as the first card in the homepage campaign carousel."
            image={form.cardImage}
            uploading={cardImgLoading}
            onPick={upload('cardImage', setCardImgLoading)}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={back} className="btn-ghost" disabled={saving}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-brand sm:min-w-40">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
