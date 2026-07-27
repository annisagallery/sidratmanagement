'use client';
import React from 'react';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import { useRouter } from 'next-nprogress-bar';
import * as api from 'src/services';
import { FiLock } from 'react-icons/fi';
import { fDate } from 'src/utils/formatTime';

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function CouponCodeForm({ data: cur }) {
  const router = useRouter();
  const isEdit = Boolean(cur);
  const isAffiliate = Boolean(cur?.isAffiliate);

  const { mutate, isLoading } = useMutation(
    isEdit ? (p) => api.updateCouponCodeByAdmin({ currentId: cur.id, ...p }) : api.addCouponCodeByAdmin,
    {
      onSuccess: (res) => {
        toast.success(res.message || 'Saved');
        router.push('/coupon-codes');
      },
      onError: (err) => toast.error(err.response?.data?.message || err.message)
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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.code.trim()) return toast.error('Code is required');
    if (!form.discount && form.discount !== 0) return toast.error('Discount is required');
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

  const field =
    'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed';
  const label = 'block text-sm font-medium text-gray-700 mb-1';

  // ── Affiliate coupon — read-only locked view ──────────────────────────────
  if (isAffiliate) {
    return (
      <div className="max-w-lg mx-auto py-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-md bg-blue-50 flex items-center justify-center mx-auto">
          <FiLock size={24} className="text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Affiliate Coupon</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          This coupon was auto-generated for an affiliate. It can only be viewed and managed from the{' '}
          <strong>Affiliates</strong> section in the Admin (HRM) panel — commission rate, discount, and status are all controlled there.
        </p>
        <div className="bg-gray-50 border rounded-md p-4 text-left space-y-2 text-sm text-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-500">Code</span>
            <span className="font-mono font-bold tracking-widest">{cur.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Discount</span>
            <span>
              {cur.type === 'percent' ? `${cur.discount}%` : `৳${cur.discount}`} off{' '}
              {cur.applyTo === 'shipping' ? 'shipping' : 'product'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Commission</span>
            <span>{cur.affiliateCommission || 0}% of order total</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Expires</span>
            <span>{cur.expire ? fDate(cur.expire) : 'No expiry'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className={`capitalize font-medium ${cur.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
              {cur.status}
            </span>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push('/coupon-codes')}
            className="px-5 py-2.5 border rounded-md text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Back to Coupon Codes
          </button>
        </div>
      </div>
    );
  }

  // ── Normal coupon add / edit form ─────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left — main fields */}
      <div className="lg:col-span-2 space-y-5 bg-white border rounded-md p-6">
        <h2 className="text-base font-semibold text-gray-800 border-b pb-2">Coupon Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Name *</label>
            <input className={field} value={form.name} onChange={set('name')} placeholder="Summer Sale" />
          </div>
          <div>
            <label className={label}>Code * (auto-uppercase)</label>
            <input
              className={`${field} uppercase tracking-widest`}
              value={form.code}
              onChange={set('code')}
              placeholder="SUMMER20"
            />
          </div>
        </div>

        <div>
          <label className={label}>Description</label>
          <textarea
            className={field}
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder="Optional coupon description"
          />
        </div>

        {/* Discount */}
        <div className="border rounded-md p-4 space-y-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Discount Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>Discount Type *</label>
              <select className={field} value={form.type} onChange={set('type')}>
                <option value="fixed">Fixed Amount (৳)</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className={label}>Discount Value *</label>
              <input
                type="number"
                min="0"
                className={field}
                value={form.discount}
                onChange={set('discount')}
                placeholder={form.type === 'percent' ? '20' : '100'}
              />
            </div>
            <div>
              <label className={label}>Apply To *</label>
              <select className={field} value={form.applyTo} onChange={set('applyTo')}>
                <option value="product">Product Subtotal</option>
                <option value="shipping">Shipping Charge</option>
              </select>
            </div>
          </div>
        </div>

        {/* Limits */}
        <div className="border rounded-md p-4 space-y-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Usage Limits</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>Min Purchase (৳)</label>
              <input
                type="number"
                min="0"
                className={field}
                value={form.minPurchase}
                onChange={set('minPurchase')}
                placeholder="0 = no minimum"
              />
            </div>
            <div>
              <label className={label}>Max Total Uses</label>
              <input
                type="number"
                min="0"
                className={field}
                value={form.maxUses}
                onChange={set('maxUses')}
                placeholder="0 = unlimited"
              />
            </div>
            <div>
              <label className={label}>Max Uses / User</label>
              <input
                type="number"
                min="1"
                className={field}
                value={form.maxPerUser}
                onChange={set('maxPerUser')}
                placeholder="1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right — meta */}
      <div className="space-y-5">
        <div className="bg-white border rounded-md p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 border-b pb-2">Validity</h2>
          <div>
            <label className={label}>Start Date</label>
            <input type="date" className={field} value={form.startDate} onChange={set('startDate')} />
          </div>
          <div>
            <label className={label}>
              Expiry Date <span className="text-gray-400 font-normal">(blank = no expiry)</span>
            </label>
            <input type="date" className={field} value={form.expire} onChange={set('expire')} />
          </div>
          <div>
            <label className={label}>Status</label>
            <select className={field} value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gray-900 text-white py-2.5 rounded-md text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition"
        >
          {isLoading ? 'Saving…' : isEdit ? 'Update Coupon' : 'Create Coupon'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/coupon-codes')}
          className="w-full border border-gray-300 text-gray-600 py-2.5 rounded-md text-sm hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
