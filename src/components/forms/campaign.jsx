'use client';
import { useState, useRef } from 'react';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import { useRouter } from 'next-nprogress-bar';
import { FiUpload } from 'react-icons/fi';
import { addCampaignByAdmin, updateCampaignByAdmin, uploadImage } from 'src/services';
import CampaignProductPicker from 'src/components/_admin/campaigns/productPicker';
import CampaignBranchPicker from 'src/components/_admin/campaigns/branchPicker';
import Image from 'next/image';

const TYPES = [
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'discount', label: 'Discount Rule' },
  { value: 'seasonal', label: 'Seasonal Event' },
  { value: 'announcement', label: 'Announcement' }
];

function inp(extra = '') {
  return `border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:border-gray-400 ${extra}`;
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

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

export default function CampaignForm({ data: existing }) {
  const router = useRouter();
  const imgRef = useRef();
  const cardImgRef = useRef();
  const [imgLoading, setImgLoading] = useState(false);
  const [cardImgLoading, setCardImgLoading] = useState(false);
  const [errors, setErrors] = useState({});

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

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (k === 'name' && !existing) next.slug = toSlug(v);
      return next;
    });
  };

  // Image upload helpers
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'campaigns');
      const res = await uploadImage(fd);
      setForm((p) => ({ ...p, cover: { path: res.data?.path || res.path } }));
    } catch {
      toast.error('Image upload failed');
    } finally {
      setImgLoading(false);
    }
  };

  const handleCardImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCardImgLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'campaigns');
      const res = await uploadImage(fd);
      setForm((p) => ({ ...p, cardImage: { path: res.data?.path || res.path } }));
    } catch {
      toast.error('Image upload failed');
    } finally {
      setCardImgLoading(false);
    }
  };

  // Validation
  const validate = () => {
    const e = {};
    if (!form.name) e.name = 'Name is required';
    if (!form.slug) e.slug = 'Slug is required';
    if (!form.discount) e.discount = 'Discount is required';
    if (!form.startDate) e.startDate = 'Start date is required';
    if (!form.endDate) e.endDate = 'End date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMut = useMutation(
    (payload) =>
      existing ? updateCampaignByAdmin({ currentSlug: existing.slug, ...payload }) : addCampaignByAdmin(payload),
    {
      onSuccess: (res) => {
        toast.success(res.message || 'Saved');
        router.push('/campaigns');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Error')
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    saveMut.mutate({ ...form, products: form.products.map((p) => p.id), branches: form.branches });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{existing ? 'Edit Campaign' : 'New Campaign'}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {existing ? `Editing: ${existing.name}` : 'Create a discount rule, flash sale or event'}
          </p>
        </div>
        <button
          type="submit"
          disabled={saveMut.isLoading}
          className="btn-brand px-6 py-2.5 text-sm disabled:opacity-50"
        >
          {saveMut.isLoading ? 'Saving…' : existing ? 'Save Changes' : 'Create Campaign'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: main info */}
        <div className="xl:col-span-2 space-y-5">
          <div className="bg-white border border-gray-100 rounded-md p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 text-sm">Campaign Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Campaign Name *" error={errors.name}>
                <input
                  className={inp(errors.name ? 'border-red-300' : '')}
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Summer Sale 2025"
                />
              </Field>
              <Field label="Slug *" error={errors.slug}>
                <input className={inp()} value={form.slug} onChange={set('slug')} placeholder="summer-sale-2025" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <select className={inp()} value={form.type} onChange={set('type')}>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select className={inp()} value={form.status} onChange={set('status')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className={inp()}
                value={form.description}
                onChange={set('description')}
                rows={3}
                placeholder="Describe this campaign…"
              />
            </Field>
          </div>

          {/* SEO */}
          <div className="bg-white border border-gray-100 rounded-md p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 text-sm">SEO</h2>
            <Field label="Meta Title">
              <input className={inp()} value={form.metaTitle} onChange={set('metaTitle')} />
            </Field>
            <Field label="Meta Description">
              <textarea className={inp()} value={form.metaDescription} onChange={set('metaDescription')} rows={2} />
            </Field>
          </div>

          <CampaignProductPicker
            products={form.products}
            onChange={(products) => setForm((p) => ({ ...p, products }))}
          />
        </div>

        {/* Right: where it applies, then discount + dates + image */}
        <div className="space-y-5">
          <CampaignBranchPicker
            selected={form.branches}
            onChange={(branches) => setForm((p) => ({ ...p, branches }))}
          />

          {/* Discount */}
          <div className="bg-white border border-gray-100 rounded-md p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 text-sm">Discount</h2>
            <Field label="Type">
              <div className="flex gap-3">
                {[
                  ['percent', '% Percent'],
                  ['fixed', '৳ Fixed']
                ].map(([v, l]) => (
                  <label
                    key={v}
                    className={`flex-1 text-center py-2 rounded-md border text-sm cursor-pointer transition-colors ${form.discountType === v ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-strong)] font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <input
                      type="radio"
                      className="hidden"
                      value={v}
                      checked={form.discountType === v}
                      onChange={() => setForm((p) => ({ ...p, discountType: v }))}
                    />
                    {l}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Discount Value *" error={errors.discount}>
              <input
                type="number"
                min={0}
                className={inp(errors.discount ? 'border-red-300' : '')}
                value={form.discount}
                onChange={set('discount')}
                placeholder={form.discountType === 'percent' ? 'e.g. 20' : 'e.g. 100'}
              />
              <p className="text-xs text-gray-400 mt-1">
                {form.discountType === 'percent' ? 'Percentage off the regular price' : 'Fixed amount off in ৳'}
              </p>
            </Field>
          </div>

          {/* Dates */}
          <div className="bg-white border border-gray-100 rounded-md p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 text-sm">Duration</h2>
            <Field label="Start Date *" error={errors.startDate}>
              <input type="datetime-local" className={inp()} value={form.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="End Date *" error={errors.endDate}>
              <input type="datetime-local" className={inp()} value={form.endDate} onChange={set('endDate')} />
            </Field>
          </div>

          {/* Cover image */}
          <div className="bg-white border border-gray-100 rounded-md p-5 space-y-3 shadow-sm">
            <h2 className="font-semibold text-gray-700 text-sm">
              Cover Image <span className="text-gray-400 font-normal">(banner/hero)</span>
            </h2>
            {form.cover?.path && (
              <Image
                src={form.cover.path}
                alt="Cover"
                width={1200}
                height={144}
                className="w-full h-36 object-cover rounded-md border"
              />
            )}
            <input type="file" accept="image/*" ref={imgRef} className="hidden" onChange={handleImageChange} />
            <button
              type="button"
              onClick={() => imgRef.current?.click()}
              disabled={imgLoading}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 py-2.5 rounded-md text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiUpload /> {imgLoading ? 'Uploading…' : form.cover?.path ? 'Change Cover' : 'Upload Cover'}
            </button>
          </div>

          {/* Card image */}
          <div className="bg-white border border-gray-100 rounded-md p-5 space-y-3 shadow-sm">
            <h2 className="font-semibold text-gray-700 text-sm">
              Card Image <span className="text-gray-400 font-normal">(homepage carousel card)</span>
            </h2>
            <p className="text-xs text-gray-400">Shown as the pinned first card in the homepage campaign carousel.</p>
            {form.cardImage?.path && (
              <Image
                src={form.cardImage.path}
                alt="Card"
                width={1200}
                height={144}
                className="w-full h-36 object-cover rounded-md border"
              />
            )}
            <input type="file" accept="image/*" ref={cardImgRef} className="hidden" onChange={handleCardImageChange} />
            <button
              type="button"
              onClick={() => cardImgRef.current?.click()}
              disabled={cardImgLoading}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 py-2.5 rounded-md text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiUpload />{' '}
              {cardImgLoading ? 'Uploading…' : form.cardImage?.path ? 'Change Card Image' : 'Upload Card Image'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end pb-4">
        <button
          type="submit"
          disabled={saveMut.isLoading}
          className="btn-brand px-8 py-3 disabled:opacity-50"
        >
          {saveMut.isLoading ? 'Saving…' : existing ? 'Save Changes' : 'Create Campaign'}
        </button>
      </div>
    </form>
  );
}
