'use client';
import React from 'react';
import { useMutation } from 'react-query';
import { useRouter } from 'next-nprogress-bar';
import { MdArrowBack, MdLock } from 'react-icons/md';
import * as api from 'src/services';
import { fDate } from 'src/utils/formatTime';
import { toastSuccess, alertError } from 'src/utils/swal';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Panel from 'src/components/_admin/ui/Panel';
import Segmented from 'src/components/_admin/ui/Segmented';
import Callout from 'src/components/_admin/ui/Callout';
import Badge, { RecordStatus } from 'src/components/_admin/ui/Badge';
import { Field } from 'src/components/_admin/ui/fields';

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const TYPE_OPTIONS = [
  { id: 'fixed', label: 'Fixed amount (৳)' },
  { id: 'percent', label: 'Percentage (%)' }
];
const APPLY_OPTIONS = [
  { id: 'product', label: 'Product subtotal' },
  { id: 'shipping', label: 'Shipping charge' }
];
const STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' }
];

const discountText = (type, discount, applyTo) => {
  const value = Number(discount) || 0;
  const amount = type === 'percent' ? `${value}%` : `৳${value.toLocaleString()}`;
  return `${amount} off ${applyTo === 'shipping' ? 'shipping' : 'the product subtotal'}`;
};

function Summary({ rows }) {
  return (
    <dl className="divide-y divide-slate-100 text-[13px]">
      {rows.map(([term, value]) => (
        <div key={term} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-slate-500">{term}</dt>
          <dd className="text-right font-medium text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function CouponCodeForm({ data: cur }) {
  const router = useRouter();
  const isEdit = Boolean(cur);
  const isAffiliate = Boolean(cur?.isAffiliate);
  const back = () => router.push('/coupon-codes');

  const { mutate, isLoading } = useMutation(
    isEdit ? (p) => api.updateCouponCodeByAdmin({ currentId: cur.id, ...p }) : api.addCouponCodeByAdmin,
    {
      onSuccess: (res) => {
        toastSuccess(res.message || (isEdit ? 'Coupon saved' : 'Coupon created'));
        back();
      },
      onError: (err) => alertError(err, { title: isEdit ? 'The coupon was not saved' : 'The coupon was not created' })
    }
  );

  const [form, setForm] = React.useState({
    name: cur?.name || '',
    code: cur?.code || '',
    description: cur?.description || '',
    type: cur?.type || 'fixed',
    discount: cur?.discount ?? '',
    applyTo: cur?.applyTo || 'product',
    minPurchase: cur?.minPurchase ?? 0,
    maxUses: cur?.maxUses ?? 0,
    maxPerUser: cur?.maxPerUser ?? 1,
    startDate: fmt(cur?.startDate),
    expire: fmt(cur?.expire),
    status: cur?.status || 'active'
  });
  const [errors, setErrors] = React.useState({});

  const put = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const set = (k) => (e) => put(k, e.target.value);

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Give the coupon a name.';
    if (!form.code.trim()) next.code = 'Enter the code customers type at checkout.';
    if (form.discount === '' || form.discount === null) next.discount = 'Enter the discount.';
    else if (Number(form.discount) < 0) next.discount = 'The discount cannot be negative.';
    else if (form.type === 'percent' && Number(form.discount) > 100) next.discount = 'A percentage cannot be more than 100.';
    if (form.startDate && form.expire && form.expire < form.startDate) next.expire = 'The expiry date is before the start date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    mutate({
      ...form,
      code: form.code.toUpperCase().trim(),
      discount: Number(form.discount),
      minPurchase: Number(form.minPurchase),
      maxUses: Number(form.maxUses),
      maxPerUser: Number(form.maxPerUser),
      // clear affiliate fields — these are managed from the Affiliates page only
      isAffiliate: false,
      affiliateCommission: 0
    });
  };

  const backButton = (
    <button type="button" onClick={back} className="btn-ghost">
      <MdArrowBack size={17} aria-hidden /> Back to coupons
    </button>
  );

  // ── Affiliate coupon — read-only locked view ──────────────────────────────
  if (isAffiliate) {
    return (
      <div className="space-y-6">
        <PageHeader title={cur.code} subtitle="Affiliate coupon" eyebrow="Coupons">
          {backButton}
        </PageHeader>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Callout tone="info" title="Managed from Affiliates">
            This coupon was generated for an affiliate. Its discount, commission and status are changed from the Affiliates
            section of the Admin (HRM) panel, not here.
          </Callout>
          <Panel title="Coupon" action={<MdLock size={18} className="text-slate-400" aria-hidden />}>
            <Summary
              rows={[
                ['Code', <span key="c" className="code-chip">{cur.code}</span>],
                ['Discount', discountText(cur.type, cur.discount, cur.applyTo)],
                ['Commission', `${cur.affiliateCommission || 0}% of order total`],
                ['Expires', cur.expire ? fDate(cur.expire) : 'Never'],
                ['Status', <RecordStatus key="s" status={cur.status} />]
              ]}
            />
          </Panel>
        </div>
      </div>
    );
  }

  // ── Normal coupon add / edit form ─────────────────────────────────────────
  const unit = form.type === 'percent' ? '%' : '৳';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <PageHeader
        title={isEdit ? `Edit ${cur.code}` : 'New coupon'}
        subtitle={isEdit ? 'Changes apply to the next checkout that uses this code.' : 'A code customers enter at checkout for a discount.'}
        eyebrow="Coupons"
      >
        {backButton}
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.name} help="For staff — customers never see it.">
                <input className="input-ui" value={form.name} onChange={set('name')} placeholder="e.g. Summer sale" autoFocus={!isEdit} />
              </Field>
              <Field label="Code" required error={errors.code} help="Saved in capitals.">
                <input
                  className="input-ui ops-code uppercase tracking-wider"
                  value={form.code}
                  onChange={set('code')}
                  placeholder="SUMMER20"
                  spellCheck={false}
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="Description" optional className="sm:col-span-2">
                <textarea
                  className="input-ui min-h-[84px] resize-y py-2"
                  rows={3}
                  value={form.description}
                  onChange={set('description')}
                  placeholder="What the coupon is for"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Discount">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Discount type">
                  <Segmented label="Discount type" options={TYPE_OPTIONS} value={form.type} onChange={(v) => put('type', v)} />
                </Field>
                <Field label="Applies to">
                  <Segmented label="Applies to" options={APPLY_OPTIONS} value={form.applyTo} onChange={(v) => put('applyTo', v)} />
                </Field>
              </div>
              <Field label={`Discount (${unit})`} required error={errors.discount} className="sm:max-w-[240px]">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={form.type === 'percent' ? 100 : undefined}
                  className="input-ui tabular-nums"
                  value={form.discount}
                  onChange={set('discount')}
                  placeholder={form.type === 'percent' ? '20' : '100'}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Limits" description="Leave at 0 for no limit.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Minimum order (৳)">
                <input type="number" inputMode="decimal" min="0" className="input-ui tabular-nums" value={form.minPurchase} onChange={set('minPurchase')} />
              </Field>
              <Field label="Total uses">
                <input type="number" inputMode="numeric" min="0" className="input-ui tabular-nums" value={form.maxUses} onChange={set('maxUses')} />
              </Field>
              <Field label="Uses per customer">
                <input type="number" inputMode="numeric" min="1" className="input-ui tabular-nums" value={form.maxPerUser} onChange={set('maxPerUser')} />
              </Field>
            </div>
          </Panel>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-0">
          <Panel title="Availability">
            <div className="space-y-4">
              <Field label="Status">
                <Segmented label="Status" options={STATUS_OPTIONS} value={form.status} onChange={(v) => put('status', v)} />
              </Field>
              <Field label="Starts" optional>
                <input type="date" className="input-ui" value={form.startDate} onChange={set('startDate')} />
              </Field>
              <Field label="Expires" optional error={errors.expire} help="Leave blank to never expire.">
                <input type="date" className="input-ui" value={form.expire} onChange={set('expire')} />
              </Field>
            </div>
          </Panel>

          <Panel title="Summary">
            <Summary
              rows={[
                ['Code', form.code.trim() ? <span key="c" className="code-chip">{form.code.toUpperCase().trim()}</span> : '—'],
                ['Gives', form.discount === '' ? '—' : discountText(form.type, form.discount, form.applyTo)],
                ['Minimum order', Number(form.minPurchase) > 0 ? `৳${Number(form.minPurchase).toLocaleString()}` : 'None'],
                ['Total uses', Number(form.maxUses) > 0 ? Number(form.maxUses).toLocaleString() : 'Unlimited'],
                ['Per customer', Number(form.maxPerUser) > 0 ? Number(form.maxPerUser).toLocaleString() : 'Unlimited'],
                ['Status', <Badge key="s" tone={form.status === 'active' ? 'success' : 'neutral'} dot>{form.status === 'active' ? 'Active' : 'Inactive'}</Badge>]
              ]}
            />
          </Panel>

          <div className="flex flex-col-reverse gap-2 sm:flex-row lg:flex-col-reverse">
            <button type="button" onClick={back} className="btn-ghost w-full" disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-brand w-full">
              {isLoading ? 'Saving…' : isEdit ? 'Save changes' : 'Create coupon'}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
