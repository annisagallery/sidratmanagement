'use client';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import React, { useState, useEffect, use, useRef } from 'react';
import { useMutation, useQuery } from 'react-query';
import * as api from 'src/services';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.css';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit2,
  FiCreditCard,
  FiPackage,
  FiMapPin,
  FiDollarSign,
  FiX,
  FiAlertTriangle,
  FiPrinter,
  FiImage,
  FiSend,
  FiUser,
  FiCheckCircle,
  FiTruck,
  FiRefreshCw,
  FiPlus,
  FiExternalLink,
  FiCopy
} from 'react-icons/fi';
import { useStatuses } from 'src/components/_admin/shared/useStatuses';
import { StatusBadge } from 'src/components/_admin/shared/StatusBadge';
import HistoryModal from 'src/components/_admin/shared/HistoryModal';
import ComplaintImagePicker from 'src/components/_admin/orders/ComplaintImagePicker';

/* ── shared bits ─────────────────────────────────────────────────────────── */

const card = 'rounded-md border border-slate-200 bg-white p-5 shadow-sm';
const fieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]';
const actionBtn =
  'w-full flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';

function InfoRow({ label, value, roomy = false }) {
  if (!value && value !== 0) return null;
  return (
    <div
      className={`grid grid-cols-[minmax(92px,0.7fr)_minmax(0,1.3fr)] gap-4 border-b border-slate-100 last:border-0 ${roomy ? 'py-3' : 'py-2.5'}`}
    >
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm leading-5 text-slate-900 font-medium text-right break-words">{value}</span>
    </div>
  );
}

function EditField({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function ModalShell({ title, subtitle, onClose, children, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center px-4">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} bg-white rounded-md shadow-xl overflow-hidden`}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            {subtitle && <p className="text-xs font-semibold text-gray-400">{subtitle}</p>}
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <FiX size={17} />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/60">{footer}</div>}
      </div>
    </div>
  );
}

const tagId = (tag) => (typeof tag === 'object' && tag !== null ? tag._id || tag.id : tag);
const tagName = (tag) => (typeof tag === 'object' && tag !== null ? tag.name || tag.title || tag.slug || tag._id || tag.id : tag);
const tagColor = (tag) => (typeof tag === 'object' && tag !== null ? tag.color : null);
const normalizeList = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);

function toast(msg) {
  Swal.fire({ title: msg, icon: 'success', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
}

const COMPLETED_ORDER_STATUSES = ['delivered', 'completed'];
const COMPLAINT_CATEGORIES = [
  ['wrong-item', 'Wrong item'],
  ['damaged', 'Damaged'],
  ['missing-item', 'Missing item'],
  ['quality', 'Quality issue'],
  ['size-fit', 'Size/Fit issue'],
  ['delivery', 'Delivery issue'],
  ['payment', 'Payment issue'],
  ['other', 'Other']
];

/* ── shipment presentation ───────────────────────────────────────────────── */

const SHIPMENT_STATUS_META = {
  pending: { label: 'Pending pickup', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_transit: { label: 'In transit', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial_delivered: { label: 'Partial delivered', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border-red-200' },
  returned: { label: 'Returned', cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  hold: { label: 'On hold', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  unknown: { label: 'Unknown', cls: 'bg-gray-100 text-gray-500 border-gray-200' }
};

const PROVIDER_LABEL = { pathao: 'Pathao', steadfast: 'Steadfast', carrybee: 'CarryBee' };

function ShipmentStatusPill({ status }) {
  const meta = SHIPMENT_STATUS_META[status] || SHIPMENT_STATUS_META.unknown;
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>;
}

function trackingUrl(shipment) {
  if (shipment.provider === 'steadfast' && shipment.trackingCode) {
    return `https://steadfast.com.bd/t/${shipment.trackingCode}`;
  }
  return null;
}

/* ── complaint modal (unchanged behavior) ────────────────────────────────── */

function AdminComplaintModal({ item, order, onClose, onSubmitted }) {
  const [form, setForm] = useState({ category: 'other', priority: 'normal', message: '', adminNote: '' });
  const [files, setFiles] = useState([]);
  const create = useMutation(
    async (payload) => {
      let attachmentIds = [];
      if (files.length) {
        const data = new FormData();
        files.forEach((entry) => data.append('files', entry.file));
        const uploaded = await api.uploadComplaintImagesByAdmin(data);
        attachmentIds = (uploaded.data || []).map((image) => image._id);
      }
      return api.createComplaintByAdmin({ ...payload, attachmentIds });
    },
    {
      onSuccess: () => {
        Swal.fire('Complaint created', 'The customer complaint has been opened for this item.', 'success');
        onSubmitted();
      },
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Could not create complaint', 'error')
    }
  );
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const save = () => {
    if (!form.message.trim()) {
      Swal.fire('Add complaint details', '', 'warning');
      return;
    }
    create.mutate({ ...form, orderItemId: item._id });
  };
  return (
    <ModalShell
      title={`Create complaint for ${item.pid?.name || 'order item'}`}
      subtitle={`Order #${order.orderNo}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-md border text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={create.isLoading}
            className="px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-40"
          >
            Create complaint
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--brand)]"
          >
            {COMPLAINT_CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={form.priority}
            onChange={(e) => update('priority', e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--brand)]"
          >
            <option value="low">Low priority</option>
            <option value="normal">Normal priority</option>
            <option value="high">High priority</option>
            <option value="urgent">Urgent priority</option>
          </select>
        </div>
        <textarea
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
          rows={4}
          placeholder="Write the customer complaint details"
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]"
        />
        <ComplaintImagePicker files={files} setFiles={setFiles} disabled={create.isLoading} />
        <textarea
          value={form.adminNote}
          onChange={(e) => update('adminNote', e.target.value)}
          rows={2}
          placeholder="Internal admin note"
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)]"
        />
      </div>
    </ModalShell>
  );
}

/* ── add payment modal ───────────────────────────────────────────────────── */

function AddPaymentModal({ orderNo, remaining, onClose, onSaved }) {
  const [form, setForm] = useState({ method: 'cash', amount: remaining > 0 ? String(remaining) : '', trxId: '', note: '' });
  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const { data: typesData } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, { staleTime: 5 * 60_000 });
  const methods = ['cash', ...normalizeList(typesData).map((t) => t.name || t.label).filter(Boolean)];

  const save = useMutation(
    () =>
      api.addOrderPayment({
        orderNo,
        method: form.method.trim(),
        amount: Number(form.amount),
        trxId: form.trxId.trim() || null,
        note: form.note.trim() || null
      }),
    {
      onSuccess: () => {
        toast('Payment added');
        onSaved();
      },
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Could not add payment', 'error')
    }
  );

  const submit = () => {
    if (!form.method.trim()) return Swal.fire('Validation', 'Payment method is required.', 'warning');
    if (!Number(form.amount) || Number(form.amount) <= 0) return Swal.fire('Validation', 'Enter a valid amount.', 'warning');
    save.mutate();
  };

  return (
    <ModalShell
      title="Add payment"
      subtitle={`Order #${orderNo}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-md border text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={save.isLoading}
            className="px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-40"
          >
            {save.isLoading ? 'Adding…' : 'Add payment'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <EditField label="Method">
          <input list="payment-method-options" className={fieldClass} value={form.method} onChange={(e) => set('method', e.target.value)} />
          <datalist id="payment-method-options">
            {methods.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </EditField>
        <EditField label={`Amount${remaining > 0 ? ` (due ৳${remaining})` : ''}`}>
          <input type="number" min="0" className={fieldClass} value={form.amount} onChange={(e) => set('amount', e.target.value)} />
        </EditField>
        <EditField label="TrxID (optional)" className="col-span-2">
          <input className={`${fieldClass} font-mono`} value={form.trxId} onChange={(e) => set('trxId', e.target.value)} />
        </EditField>
        <EditField label="Note (optional)" className="col-span-2">
          <input className={fieldClass} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </EditField>
      </div>
    </ModalShell>
  );
}

/* ── edit details modal ──────────────────────────────────────────────────── */

function EditDetailsModal({ order, orderNo, onClose, onSaved }) {
  const address = order.shippingAddress || {};
  const [draft, setDraft] = useState({
    shippingAddress: {
      ...address,
      name: address.name || '',
      phone: address.phone || '',
      district: address.district || (typeof address.city === 'object' ? address.city?.city_name || '' : address.city || ''),
      upazila: address.upazila || (typeof address.zone === 'object' ? address.zone?.zone_name || '' : address.zone || ''),
      area: address.area || '',
      address: address.address || ''
    },
    shipping: order.shipping || 0,
    discount: order.discount || 0,
    paymentMethod: order.paymentMethod || 'cod',
    deliveryType: order.deliveryType || 'regular',
    estimatedDelivery: order.estimatedDelivery ? format(new Date(order.estimatedDelivery), 'yyyy-MM-dd') : '',
    tags: (order.tags || []).map(tagName).filter(Boolean).join(', '),
    note: order.note || ''
  });
  const setDraftField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setAddressField = (key, value) =>
    setDraft((current) => ({ ...current, shippingAddress: { ...current.shippingAddress, [key]: value } }));

  const { data: orderTags = [] } = useQuery(
    ['orderTags'],
    async () => {
      if (typeof api.getOrderTagsByAdmin !== 'function') return [];
      return normalizeList(await api.getOrderTagsByAdmin());
    },
    { staleTime: 5 * 60 * 1000 }
  );

  function resolveDraftTags() {
    const tokens = String(draft?.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!orderTags.length) {
      const currentNames = (order?.tags || []).map(tagName).filter(Boolean).join(', ');
      return draft?.tags === currentNames ? (order?.tags || []).map(tagId).filter(Boolean) : [];
    }
    const tagsByName = new Map(orderTags.map((tag) => [String(tagName(tag)).toLowerCase(), tagId(tag)]));
    const validIds = new Set(orderTags.map((tag) => String(tagId(tag))));
    return tokens
      .map((token) => {
        if (validIds.has(token)) return token;
        return tagsByName.get(token.toLowerCase());
      })
      .filter(Boolean);
  }

  const save = useMutation(
    () =>
      api.updateOrderStatus({
        id: orderNo,
        ...draft,
        shipping: Number(draft.shipping || 0),
        discount: Number(draft.discount || 0),
        estimatedDelivery: draft.estimatedDelivery || null,
        tags: resolveDraftTags()
      }),
    {
      onSuccess: () => {
        toast('Order details saved');
        onSaved();
      },
      onError: (e) =>
        Swal.fire('Could not save changes', e?.response?.data?.message || 'Please check the fields and try again.', 'error')
    }
  );

  return (
    <ModalShell
      title="Edit order details"
      subtitle={`Order #${orderNo}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button onClick={onClose} disabled={save.isLoading} className="px-4 py-2 rounded-md border text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isLoading}
            className="px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-40"
          >
            {save.isLoading ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Shipping address</p>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Recipient">
              <input className={fieldClass} value={draft.shippingAddress.name} onChange={(e) => setAddressField('name', e.target.value)} />
            </EditField>
            <EditField label="Phone">
              <input className={fieldClass} value={draft.shippingAddress.phone} onChange={(e) => setAddressField('phone', e.target.value)} />
            </EditField>
            <EditField label="District">
              <input className={fieldClass} value={draft.shippingAddress.district} onChange={(e) => setAddressField('district', e.target.value)} />
            </EditField>
            <EditField label="Upazila">
              <input className={fieldClass} value={draft.shippingAddress.upazila} onChange={(e) => setAddressField('upazila', e.target.value)} />
            </EditField>
            <EditField label="Area" className="col-span-2">
              <input className={fieldClass} value={draft.shippingAddress.area} onChange={(e) => setAddressField('area', e.target.value)} />
            </EditField>
            <EditField label="Street address" className="col-span-2">
              <textarea
                rows={2}
                className={`${fieldClass} resize-none`}
                value={draft.shippingAddress.address}
                onChange={(e) => setAddressField('address', e.target.value)}
              />
            </EditField>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Charges & details</p>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Shipping charge">
              <input type="number" min="0" className={fieldClass} value={draft.shipping} onChange={(e) => setDraftField('shipping', e.target.value)} />
            </EditField>
            <EditField label="Discount">
              <input type="number" min="0" className={fieldClass} value={draft.discount} onChange={(e) => setDraftField('discount', e.target.value)} />
            </EditField>
            <EditField label="Payment method">
              <input className={fieldClass} value={draft.paymentMethod} onChange={(e) => setDraftField('paymentMethod', e.target.value)} />
            </EditField>
            <EditField label="Delivery type">
              <select className={fieldClass} value={draft.deliveryType} onChange={(e) => setDraftField('deliveryType', e.target.value)}>
                <option value="regular">Regular</option>
                <option value="urgent">Urgent</option>
                <option value="sameDay">Same day</option>
              </select>
            </EditField>
            <EditField label="Estimated delivery">
              <input type="date" className={fieldClass} value={draft.estimatedDelivery} onChange={(e) => setDraftField('estimatedDelivery', e.target.value)} />
            </EditField>
            <EditField label="Tags">
              <input className={fieldClass} value={draft.tags} onChange={(e) => setDraftField('tags', e.target.value)} placeholder="priority, gift, fragile" />
              <span className="mt-1 block text-[11px] text-slate-400">Separate tags with commas.</span>
            </EditField>
            <EditField label="Customer note" className="col-span-2">
              <textarea rows={2} className={`${fieldClass} resize-none`} value={draft.note} onChange={(e) => setDraftField('note', e.target.value)} />
            </EditField>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

/* ── ship modal ──────────────────────────────────────────────────────────── */

function ShipModal({ orderNo, order, meta, isResend, onClose, onSent }) {
  const { data: optionsData, isLoading: loadingOptions } = useQuery(['courier-options'], api.getCourierOptions, {
    staleTime: 60_000
  });
  const options = normalizeList(optionsData);
  const defaultAccount = options.find((o) => o.isDefault) || options[0];

  const [form, setForm] = useState({
    accountId: '',
    codAmount: String(meta?.suggestedCod ?? ''),
    weight: '0.5',
    itemQuantity: String((order.items || []).length || 1),
    deliveryType: '48',
    note: ''
  });
  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    if (!form.accountId && defaultAccount) set('accountId', defaultAccount._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAccount?._id]);

  const selected = options.find((o) => o._id === form.accountId);
  const address = order.shippingAddress || {};

  const send = useMutation(
    () =>
      api.createOrderShipment({
        orderNo,
        accountId: form.accountId,
        codAmount: Number(form.codAmount) || 0,
        weight: Number(form.weight) || 0.5,
        itemQuantity: Number(form.itemQuantity) || 1,
        deliveryType: form.deliveryType,
        note: form.note.trim()
      }),
    {
      onSuccess: (res) => {
        toast(res?.message || 'Shipment created');
        onSent();
      },
      onError: (e) => {
        const message = e?.response?.data?.message || 'The courier rejected the request.';
        const providerError = e?.response?.data?.providerError;
        Swal.fire({
          title: 'Could not send shipment',
          html: `<p class="text-sm">${message}</p>${
            providerError ? `<pre class="text-left text-xs bg-gray-100 rounded p-2 mt-2 overflow-auto max-h-40">${JSON.stringify(providerError, null, 2)}</pre>` : ''
          }`,
          icon: 'error'
        });
      }
    }
  );

  const submit = () => {
    if (!form.accountId) return Swal.fire('Validation', 'Choose a courier account.', 'warning');
    send.mutate();
  };

  return (
    <ModalShell
      title={isResend ? 'Re-send shipment' : 'Send shipment'}
      subtitle={`Order #${orderNo}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-md border text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={send.isLoading || !options.length}
            className="px-4 py-2 rounded-md bg-[var(--brand)] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-40 inline-flex items-center gap-2"
          >
            <FiTruck size={15} /> {send.isLoading ? 'Sending…' : isResend ? 'Re-send parcel' : 'Send parcel'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {isResend && (
          <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">
            <FiAlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            The previous shipment was cancelled/returned. This creates a fresh consignment (the old one stays in history).
          </div>
        )}

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-800">{address.name} · {address.phone}</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {[address.address, address.area, address.upazila, address.district].filter(Boolean).join(', ')}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Wrong address? Close this and use “Edit details” first.</p>
        </div>

        {loadingOptions ? (
          <p className="text-sm text-gray-400">Loading courier accounts…</p>
        ) : !options.length ? (
          <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 text-center">
            No active courier accounts. Add one in <a href="/shipping/couriers" className="text-[var(--brand-strong)] underline">Shipping → Couriers</a>.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Courier account" className="col-span-2">
              <select className={fieldClass} value={form.accountId} onChange={(e) => set('accountId', e.target.value)}>
                {options.map((o) => (
                  <option key={o._id} value={o._id}>
                    {PROVIDER_LABEL[o.provider]} — {o.name}
                    {o.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </EditField>
            <EditField label="COD amount (৳)">
              <input type="number" min="0" className={fieldClass} value={form.codAmount} onChange={(e) => set('codAmount', e.target.value)} />
            </EditField>
            <EditField label="Item quantity">
              <input type="number" min="1" className={fieldClass} value={form.itemQuantity} onChange={(e) => set('itemQuantity', e.target.value)} />
            </EditField>
            {selected?.provider === 'pathao' && (
              <>
                <EditField label="Weight (kg)">
                  <input type="number" min="0.5" max="10" step="0.5" className={fieldClass} value={form.weight} onChange={(e) => set('weight', e.target.value)} />
                </EditField>
                <EditField label="Delivery type">
                  <select className={fieldClass} value={form.deliveryType} onChange={(e) => set('deliveryType', e.target.value)}>
                    <option value="48">Normal (48h)</option>
                    <option value="12">On-demand (12h)</option>
                  </select>
                </EditField>
              </>
            )}
            <EditField label="Note to courier (optional)" className="col-span-2">
              <input className={fieldClass} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. Fragile, call before delivery" />
            </EditField>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* ── shipments list (left column, styled like Payments) ──────────────────── */

function ShipmentsListCard({ shipments, onRefresh, refreshingId }) {
  const copy = (text) => {
    navigator.clipboard?.writeText(String(text));
    toast('Copied');
  };

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiTruck size={16} className="text-[var(--brand-strong)]" />
          <h2 className="font-semibold text-gray-800">Shipments</h2>
        </div>
        {shipments.length > 0 && (
          <span className="text-xs text-gray-400">
            {shipments.length} attempt{shipments.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {shipments.length > 0 ? (
        <div className="space-y-2">
          {shipments.map((s) => {
            const url = trackingUrl(s);
            return (
              <div
                key={s._id}
                className={`flex items-center justify-between gap-3 p-3 rounded-md bg-gray-50 border border-gray-100 group ${s.isActive ? '' : 'opacity-60'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-[var(--brand-soft)] flex items-center justify-center flex-shrink-0">
                    <FiTruck size={14} className="text-[var(--brand-strong)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {PROVIDER_LABEL[s.provider]} · {s.accountName}
                      {!s.isActive && <span className="ml-1.5 text-[10px] font-semibold uppercase text-gray-400">superseded</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate flex items-center gap-1.5">
                      <span className="font-mono">{s.consignmentId}</span>
                      <button onClick={() => copy(s.consignmentId)} className="text-gray-300 hover:text-gray-500" title="Copy">
                        <FiCopy size={11} />
                      </button>
                      · ৳{s.codAmount || 0} COD · {format(new Date(s.createdAt), 'dd/MM hh:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ShipmentStatusPill status={s.status} />
                  <button
                    onClick={() => onRefresh(s._id)}
                    disabled={refreshingId === s._id}
                    className="text-gray-300 hover:text-gray-600 transition disabled:opacity-50"
                    title="Refresh status from the courier"
                  >
                    <FiRefreshCw size={13} className={refreshingId === s._id ? 'animate-spin' : ''} />
                  </button>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gray-300 hover:text-gray-600 transition"
                      title="Track parcel"
                    >
                      <FiExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-2">No shipments yet — use “Send shipment” in the actions panel.</p>
      )}
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────────────────── */

export default function OrderDetail({ params }) {
  const { orderNo } = use(params);
  const router = useRouter();

  const { statuses: orderStatuses } = useStatuses('order');
  const { statuses: itemStatuses } = useStatuses('orderItem');

  const { data, isLoading, refetch } = useQuery(['admin-order', orderNo], () => api.getOrderByAdmin(orderNo), {
    refetchOnWindowFocus: false
  });
  const order = data?.data;

  const { data: shipmentsData, refetch: refetchShipments } = useQuery(
    ['order-shipments', orderNo],
    () => api.getOrderShipments(orderNo),
    { refetchOnWindowFocus: false }
  );
  const shipments = shipmentsData?.data || [];
  const shipMeta = shipmentsData?.meta || { canSend: true, isResend: false, suggestedCod: 0 };

  const [currentStatus, setCurrentStatus] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [complaintItem, setComplaintItem] = useState(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [showShip, setShowShip] = useState(false);
  const [refreshingShipment, setRefreshingShipment] = useState(null);
  const [commentBody, setCommentBody] = useState('');
  const [commentFiles, setCommentFiles] = useState([]);
  const commentFileRef = useRef(null);
  const packScanRef = useRef(null);
  const audioContextRef = useRef(null);
  const [packBarcode, setPackBarcode] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null);
  const [manualAssignItem, setManualAssignItem] = useState('');

  useEffect(() => {
    if (order?.status) setCurrentStatus(order.status);
  }, [order?._id, order?.status]);

  useEffect(() => {
    const h = (e) => {
      if (!order) return;
      if (e.key === 'ArrowLeft' && order.previousOrder) router.push(`/orders/${order.previousOrder}`);
      if (e.key === 'ArrowRight' && order.nextOrder) router.push(`/orders/${order.nextOrder}`);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [order, router]);

  /* mutations */
  const { mutate: updateStatus, isLoading: updatingStatus } = useMutation(
    (status) => api.updateOrderStatusByAdmin({ orderNo, status }),
    {
      onSuccess: (_, status) => {
        setCurrentStatus(status);
        refetch();
        toast('Status updated');
      },
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
    }
  );

  const { mutate: packOrder, isLoading: packingOrder } = useMutation(() => api.packOrderByAdmin(orderNo), {
    onSuccess: () => {
      refetch();
      toast('Order packed');
    },
    onError: (e) => Swal.fire('Cannot pack order', e?.response?.data?.message || 'Not all products are ready', 'error')
  });

  function playScanTone(success) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      (success ? [880] : [220, 165]).forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + index * 0.13;
        oscillator.type = success ? 'sine' : 'square';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(success ? 0.12 : 0.16, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.12);
      });
    } catch (_) {}
  }

  const { mutate: scanForPacking, isLoading: scanningForPacking } = useMutation(
    (payload) => api.scanOrderItemForPacking({ orderNo, ...payload }),
    {
      onSuccess: async (response) => {
        playScanTone(true);
        setScanFeedback({ type: 'success', message: response.message, barcode: response.data?.barcode });
        setPackBarcode('');
        setManualAssignItem('');
        await refetch();
        requestAnimationFrame(() => packScanRef.current?.focus());
      },
      onError: (error, payload) => {
        playScanTone(false);
        setScanFeedback({
          type: 'error',
          message: error?.response?.data?.message || 'No matching product found.',
          barcode: payload.barcode,
          manualAllowed: error?.response?.data?.manualAllowed === true
        });
        setPackBarcode('');
        requestAnimationFrame(() => packScanRef.current?.focus());
      }
    }
  );

  const { mutate: updateItemStatus, isLoading: updatingItemStatus } = useMutation(
    ({ itemId, status }) => api.updateItemInOrder({ orderNo, itemId, status }),
    {
      onSuccess: () => {
        refetch();
        toast('Product status updated');
      },
      onError: (e) =>
        Swal.fire('Cannot change product status', e?.response?.data?.message || 'The next production step is required.', 'error')
    }
  );

  const { mutate: removePayment } = useMutation((paymentId) => api.removeOrderPayment({ orderNo, paymentId }), {
    onSuccess: () => {
      refetch();
      toast('Payment removed');
    },
    onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Failed', 'error')
  });

  const { mutate: postComment, isLoading: postingComment } = useMutation(
    async () => {
      let imageIds = [];
      if (commentFiles.length) {
        const form = new FormData();
        commentFiles.forEach((item) => form.append('files', item.file));
        form.append('model', 'order-admin-comments');
        const uploaded = await api.uploadImages(form);
        imageIds = (uploaded || []).map((image) => image._id || image.id).filter(Boolean);
      }
      return api.addOrderAdminComment({ orderNo, body: commentBody.trim(), imageIds });
    },
    {
      onSuccess: () => {
        commentFiles.forEach((item) => URL.revokeObjectURL(item.preview));
        setCommentFiles([]);
        setCommentBody('');
        refetch();
        toast('Comment added');
      },
      onError: (e) => Swal.fire('Error', e?.response?.data?.message || 'Could not add comment', 'error')
    }
  );

  async function refreshShipment(id) {
    setRefreshingShipment(id);
    try {
      await api.refreshShipmentStatus(id);
      await refetchShipments();
      toast('Shipment status refreshed');
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.message || 'Could not refresh from the courier', 'error');
    } finally {
      setRefreshingShipment(null);
    }
  }

  function addCommentFiles(e) {
    const selected = Array.from(e.target.files || []).slice(0, Math.max(0, 10 - commentFiles.length));
    setCommentFiles((current) => [
      ...current,
      ...selected.map((file) => ({ file, preview: URL.createObjectURL(file), id: `${file.name}-${file.lastModified}` }))
    ]);
    e.target.value = '';
  }

  function removeCommentFile(id) {
    setCommentFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  }

  function handleStatusChange(e) {
    const status = e.target.value;
    Swal.fire({
      title: 'Change Status?',
      text: `Change to "${status}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, change'
    }).then((r) => {
      if (r.isConfirmed) updateStatus(status);
      else setCurrentStatus(order.status);
    });
  }

  function handlePackingScan(event) {
    event?.preventDefault();
    const barcode = packBarcode.trim();
    if (!barcode || scanningForPacking) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current && AudioContext) audioContextRef.current = new AudioContext();
    } catch (_) {}
    setScanFeedback(null);
    setManualAssignItem('');
    scanForPacking({ barcode });
  }

  function handleManualAssignment() {
    if (!scanFeedback?.barcode || !manualAssignItem || scanningForPacking) return;
    scanForPacking({ barcode: scanFeedback.barcode, itemId: manualAssignItem, manual: true });
  }

  function nextItemStatus(current) {
    if (['pending', 'production-needed', 'reserved', 'ready', 'packed', 'delivered', 'returned', 'cancelled'].includes(current))
      return null;
    const workflow = itemStatuses.filter(
      (entry) =>
        entry.isActive !== false && !['reserved', 'packed', 'delivered', 'returned', 'return', 'cancelled'].includes(entry.value)
    );
    return workflow[workflow.findIndex((entry) => entry.value === current) + 1] || null;
  }

  const visibleOrderStatuses = (() => {
    const active = orderStatuses.filter(
      (entry) => entry.isActive !== false && (entry.value !== 'processing' || entry.value === currentStatus)
    );
    const currentIndex = active.findIndex((entry) => entry.value === currentStatus);
    const values = new Set([currentStatus]);
    const next = active[currentIndex + 1];
    if (next && next.value !== 'packed') values.add(next.value);
    if (!['shipped', 'delivered', 'returned', 'cancelled'].includes(currentStatus)) values.add('cancelled');
    if (currentStatus === 'delivered') values.add('returned');
    return active.filter((entry) => values.has(entry.value));
  })();

  function handleRemovePayment(paymentId) {
    Swal.fire({
      title: 'Remove payment?',
      text: 'This will unlink the payment.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#ef4444'
    }).then((r) => {
      if (r.isConfirmed) removePayment(paymentId);
    });
  }

  function afterShipmentSent() {
    setShowShip(false);
    refetchShipments();
    if (!['shipped', 'delivered', 'returned', 'cancelled'].includes(order.status)) {
      Swal.fire({
        title: 'Mark order as shipped?',
        text: 'The parcel was handed to the courier.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, mark shipped'
      }).then((r) => {
        if (r.isConfirmed) updateStatus('shipped');
      });
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }
  if (!order) return <div className="p-16 text-center text-red-500 text-sm">Order not found.</div>;

  const canCreateItemComplaint = COMPLETED_ORDER_STATUSES.includes(order.status);
  const totalPaid = (order.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  const remainingDue = Math.max(0, Math.round((order.total || 0) - totalPaid));
  const activeShipment = shipments.find((s) => s.isActive);

  return (
    <div className="space-y-5 pb-16">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-[var(--brand)]" />
        <div className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/orders')}
              aria-label="Back to orders"
              className="p-2 rounded-md hover:bg-slate-100 text-slate-500"
            >
              <FiChevronLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-950">Order #{order.orderNo}</h1>
                {order.source === 'admin' && (
                  <span className="text-xs bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--brand-ring)] px-2 py-0.5 rounded-md font-medium">
                    Manual
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Placed {format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {order.previousOrder && (
              <button
                onClick={() => router.push(`/orders/${order.previousOrder}`)}
                title="Previous order (←)"
                className="p-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                <FiChevronLeft size={16} />
              </button>
            )}
            {order.nextOrder && (
              <button
                onClick={() => router.push(`/orders/${order.nextOrder}`)}
                title="Next order (→)"
                className="p-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                <FiChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70 sm:grid-cols-5">
          <div className="px-5 py-3 border-r border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
            <div className="mt-1">
              <StatusBadge status={order.status} statuses={orderStatuses} />
            </div>
          </div>
          <div className="px-5 py-3 border-r border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Courier</p>
            <div className="mt-1">
              {activeShipment ? (
                <ShipmentStatusPill status={activeShipment.status} />
              ) : (
                <span className="text-sm font-medium text-slate-400">Not sent</span>
              )}
            </div>
          </div>
          <div className="px-5 py-3 border-r border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {order.userId?.name || order.guestName || order.shippingAddress?.name || 'Guest'}
            </p>
          </div>
          <div className="px-5 py-3 border-r border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Payment</p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-800">{order.paymentStatus || 'unpaid'}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Order total</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-950">৳{(order.total || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* modals */}
      {showHistory && (
        <HistoryModal title={`Order #${order.orderNo} History`} model="Order" docId={order._id} onClose={() => setShowHistory(false)} />
      )}
      {complaintItem && (
        <AdminComplaintModal
          item={complaintItem}
          order={order}
          onClose={() => setComplaintItem(null)}
          onSubmitted={() => {
            setComplaintItem(null);
            refetch();
          }}
        />
      )}
      {showAddPayment && (
        <AddPaymentModal
          orderNo={orderNo}
          remaining={remainingDue}
          onClose={() => setShowAddPayment(false)}
          onSaved={() => {
            setShowAddPayment(false);
            refetch();
          }}
        />
      )}
      {showEditDetails && (
        <EditDetailsModal
          order={order}
          orderNo={orderNo}
          onClose={() => setShowEditDetails(false)}
          onSaved={() => {
            setShowEditDetails(false);
            refetch();
          }}
        />
      )}
      {showShip && (
        <ShipModal
          orderNo={orderNo}
          order={order}
          meta={shipMeta}
          isResend={shipMeta.isResend}
          onClose={() => setShowShip(false)}
          onSent={afterShipmentSent}
        />
      )}

      {/* ── OVERVIEW: shipping · summary · order details ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SHIPPING ADDRESS */}
        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <FiMapPin size={16} className="text-[var(--brand-strong)]" />
            <h2 className="font-semibold text-gray-800">Shipping</h2>
          </div>
          <InfoRow label="Name" value={order.shippingAddress?.name} />
          <InfoRow label="Phone" value={order.shippingAddress?.phone} />
          <InfoRow
            label="District"
            value={order.shippingAddress?.district || order.shippingAddress?.city?.city_name || order.shippingAddress?.city}
          />
          <InfoRow
            label="Upazila"
            value={order.shippingAddress?.upazila || order.shippingAddress?.zone?.zone_name || order.shippingAddress?.zone}
          />
          {order.shippingAddress?.area && <InfoRow label="Area" value={order.shippingAddress.area} />}
          <InfoRow label="Address" value={order.shippingAddress?.address} />
        </div>

        {/* SUMMARY */}
        <div className={card}>
          <div className="flex items-center gap-2 mb-3">
            <FiDollarSign size={16} className="text-[var(--brand-strong)]" />
            <h2 className="font-semibold text-gray-800">Summary</h2>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>৳{(order.subTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>৳{(order.shipping || 0).toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-৳{order.discount.toFixed(2)}</span>
              </div>
            )}
            {order.cashDiscount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Cash</span>
                <span>-৳{order.cashDiscount.toFixed(2)}</span>
              </div>
            )}
            {order.vat > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>VAT ({order.vatPercent}%)</span>
                <span>৳{order.vat.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900 text-base">
              <span>Total</span>
              <span>৳{(order.total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-[var(--brand-strong)]">
              <span>Paid</span>
              <span>৳{totalPaid.toFixed(2)}</span>
            </div>
            {remainingDue > 0 && (
              <div className="flex justify-between text-xs font-semibold text-amber-600">
                <span>Due</span>
                <span>৳{remainingDue.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-gray-500">Payment Status</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-md font-medium ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
              >
                {order.paymentStatus || 'unpaid'}
              </span>
            </div>
          </div>
        </div>

        {/* ORDER DETAILS */}
        <div className={card}>
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Order Details</h2>
          <InfoRow label="Payment Method" value={order.paymentMethod || 'COD'} />
          <InfoRow label="Delivery Type" value={order.deliveryType} />
          {order.estimatedDelivery && <InfoRow label="Est. Delivery" value={format(new Date(order.estimatedDelivery), 'dd MMM yyyy')} />}
          {order.coupon && <InfoRow label="Coupon" value={order.coupon} />}
          {(order.tags || []).length > 0 && (
            <div className="py-2 flex justify-between items-start gap-4 border-b border-gray-50">
              <span className="text-xs text-gray-400">Tags</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {order.tags.map((t) => (
                  <span
                    key={tagId(t)}
                    className="text-xs bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--brand-ring)] px-2 py-0.5 rounded-md"
                    style={tagColor(t) ? { borderColor: tagColor(t), color: tagColor(t), backgroundColor: `${tagColor(t)}14` } : undefined}
                  >
                    {tagName(t)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── GRID ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left (2 cols): content ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {order.status === 'ready-to-pack' && (
            <section className="overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-white shadow-sm">
              <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-400">Packing verification</p>
                  <h2 className="mt-1 text-lg font-bold">Scan each physical product</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Production pieces require their unique unit code. Reserved stock accepts its product or variation barcode.
                  </p>
                  <form onSubmit={handlePackingScan} className="mt-4 flex gap-2">
                    <input
                      ref={packScanRef}
                      autoFocus
                      value={packBarcode}
                      onChange={(event) => setPackBarcode(event.target.value)}
                      disabled={scanningForPacking}
                      placeholder="Scan barcode…"
                      className="h-11 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 font-mono text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                    />
                    <button
                      disabled={!packBarcode.trim() || scanningForPacking}
                      className="h-11 rounded-md bg-sky-500 px-4 text-sm font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-40"
                    >
                      {scanningForPacking ? 'Checking…' : 'Verify'}
                    </button>
                  </form>
                  {scanFeedback && (
                    <div
                      role="alert"
                      className={`mt-3 rounded-md px-3 py-2 text-sm font-semibold ${scanFeedback.type === 'success' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}
                    >
                      {scanFeedback.message}
                    </div>
                  )}
                  {scanFeedback?.type === 'error' && scanFeedback.manualAllowed && (
                    <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/10 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Manual assignment</p>
                      <p className="mt-1 text-xs text-slate-400">Override only after physically checking the product.</p>
                      <div className="mt-2 flex gap-2">
                        <select
                          value={manualAssignItem}
                          onChange={(event) => setManualAssignItem(event.target.value)}
                          className="h-10 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-amber-400"
                        >
                          <option value="">Choose unverified item</option>
                          {(order.items || [])
                            .filter((item) => ['reserved', 'ready'].includes(item.status) && !item.packVerifiedAt)
                            .map((item) => (
                              <option key={item._id} value={item._id}>
                                {item.pid?.name || item.productSnapshot?.name || 'Product'} ·{' '}
                                {(item.attributes || []).map((attribute) => attribute.valueName).join(' / ')}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleManualAssignment}
                          disabled={!manualAssignItem || scanningForPacking}
                          className="h-10 rounded-md bg-amber-400 px-3 text-sm font-bold text-slate-950 disabled:opacity-40"
                        >
                          Assign manually
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-md border border-slate-700 bg-slate-900 p-4 text-center">
                  <p className="font-mono text-3xl font-black text-white">
                    {order.packingProgress?.verified || 0}
                    <span className="text-lg text-slate-500">/{order.packingProgress?.total || 0}</span>
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Products verified</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-md bg-slate-800">
                    <div
                      className="h-full rounded-md bg-emerald-400 transition-all"
                      style={{
                        width: `${order.packingProgress?.total ? (order.packingProgress.verified / order.packingProgress.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ITEMS */}
          <div className={card}>
            <div className="flex items-center gap-2 mb-4">
              <FiPackage size={16} className="text-[var(--brand-strong)]" />
              <h2 className="font-semibold text-gray-800">Items ({(order.items || []).length})</h2>
            </div>

            <div className="overflow-x-auto -mx-1">
              <GlobalTable className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Product</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Price</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Packing assignment</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item) => (
                    <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {item.pid?.featuredImage?.path && (
                            <div className="w-9 h-9 rounded-md border overflow-hidden flex-shrink-0 relative">
                              <Image src={item.pid.featuredImage.path} alt="" fill className="object-cover" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{item.pid?.name || '—'}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {(item.attributes || []).map((a, i) => (
                                <span key={i} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                  {a.colorHex && <span className="w-2.5 h-2.5 rounded-md border" style={{ backgroundColor: a.colorHex }} />}
                                  {a.valueName}
                                </span>
                              ))}
                              {item.customizePrice > 0 && (
                                <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">+৳{item.customizePrice}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {item.salePrice ? (
                          <div>
                            <span className="text-xs text-gray-400 line-through block">৳{item.regularPrice}</span>
                            <span className="font-semibold text-gray-800">৳{item.price}</span>
                          </div>
                        ) : (
                          <span className="font-semibold text-gray-800">৳{item.price}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <StatusBadge status={item.status} statuses={itemStatuses} />
                          {nextItemStatus(item.status) && order.status !== 'packed' && (
                            <button
                              type="button"
                              disabled={updatingItemStatus}
                              onClick={() => updateItemStatus({ itemId: item._id, status: nextItemStatus(item.status).value })}
                              className="text-[11px] font-semibold text-[var(--brand-strong)] hover:underline disabled:opacity-40"
                            >
                              Move to {nextItemStatus(item.status).label}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {item.assignedUnit && <span className="font-mono text-xs text-slate-500">{item.assignedUnit.barcode}</span>}
                          {item.packVerifiedAt ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              <FiCheckCircle /> {item.packingBarcode}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600">Awaiting scan</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => setComplaintItem(item)}
                          disabled={!canCreateItemComplaint}
                          title={canCreateItemComplaint ? 'Create complaint for customer' : 'Only completed orders can be complained'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-100 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FiAlertTriangle size={13} /> Complain
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!order.items || order.items.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">
                        No items in this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </GlobalTable>
            </div>
          </div>

          {/* PAYMENTS — list only; adding happens from the actions column */}
          <div className={card}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FiCreditCard size={16} className="text-[var(--brand-strong)]" />
                <h2 className="font-semibold text-gray-800">Payments</h2>
              </div>
              <span className="text-xs text-gray-400">
                Paid ৳{totalPaid.toFixed(2)} / ৳{(order.total || 0).toFixed(2)}
              </span>
            </div>

            {(order.payments || []).length > 0 ? (
              <div className="space-y-2">
                {order.payments.map((p) => (
                  <div key={p._id} className="flex items-center justify-between gap-3 p-3 rounded-md bg-gray-50 border border-gray-100 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-[var(--brand-soft)] flex items-center justify-center flex-shrink-0">
                        <FiDollarSign size={14} className="text-[var(--brand-strong)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">৳{p.amount?.toFixed(2)}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {p.method} {p.trxId && `· ${p.trxId}`} {p.note && `· ${p.note}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-medium ${p.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                      >
                        {p.status || 'pending'}
                      </span>
                      <button
                        onClick={() => handleRemovePayment(p._id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                        aria-label="Remove payment"
                      >
                        <FiX size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-2">No payments recorded — use “Add payment” in the actions panel.</p>
            )}
          </div>

          {/* SHIPMENTS — list only; sending happens from the actions column */}
          <ShipmentsListCard shipments={shipments} onRefresh={refreshShipment} refreshingId={refreshingShipment} />

          {order.note && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Customer Note</p>
              <p className="text-sm text-gray-700">{order.note}</p>
            </div>
          )}
        </div>

        {/* ── Right: actions, admin comments + reference cards ────────────── */}
        <div className="space-y-4">
          {/* ACTIONS */}
          <div className={card}>
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">Actions</h2>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Order status</span>
                <select
                  value={currentStatus}
                  onChange={handleStatusChange}
                  disabled={updatingStatus}
                  className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand)] font-medium disabled:opacity-50 bg-white"
                >
                  {visibleOrderStatuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={() => packOrder()}
                disabled={!order.canPack || packingOrder || order.status === 'packed'}
                title={order.canPack ? 'Pack this verified order' : 'Scan every reserved or ready product first'}
                className={`${actionBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
              >
                <FiPackage size={15} /> {packingOrder ? 'Packing…' : order.status === 'packed' ? 'Packed' : 'Pack order'}
              </button>

              <button
                onClick={() => setShowShip(true)}
                disabled={!shipMeta.canSend}
                title={
                  shipMeta.canSend
                    ? shipMeta.isResend
                      ? 'Previous shipment was cancelled/returned — send again'
                      : 'Send this order with Pathao, Steadfast or CarryBee'
                    : 'An active shipment already exists'
                }
                className={`${actionBtn} ${
                  shipMeta.isResend
                    ? 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100'
                    : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                }`}
              >
                <FiTruck size={15} /> {shipMeta.isResend ? 'Re-send shipment' : 'Send shipment'}
              </button>

              <button onClick={() => setShowAddPayment(true)} className={`${actionBtn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}>
                <FiPlus size={15} /> Add payment
              </button>

              <button
                onClick={() => router.push(`/orders/${orderNo}/edit`)}
                className={`${actionBtn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}
              >
                <FiPackage size={15} /> Add / remove products
              </button>

              <button onClick={() => setShowEditDetails(true)} className={`${actionBtn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}>
                <FiEdit2 size={15} /> Edit details
              </button>

              <button
                onClick={() => window.open(`/invoice/${orderNo}`, '_blank')}
                className={`${actionBtn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}
              >
                <FiPrinter size={15} /> Print invoice
              </button>

              <button onClick={() => setShowHistory(true)} className={`${actionBtn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}>
                <FiClock size={15} /> Order history
              </button>
            </div>
          </div>

          {/* CUSTOMER */}
          {(order.userId || order.guestName) && (
            <div className={card}>
              <div className="mb-3 flex items-center gap-2">
                <FiUser size={15} className="text-[var(--brand-strong)]" />
                <h2 className="font-semibold text-gray-800 text-sm">Customer</h2>
              </div>
              <InfoRow label="Name" value={order.userId?.name || order.guestName} />
              <InfoRow label="Phone" value={order.userId?.phone || order.shippingAddress?.phone} />
              {order.userId?.email && <InfoRow label="Email" value={order.userId.email} />}
              {order.userId?._id && (
                <div className="pt-2">
                  <a href={`/users/${order.userId._id}`} className="text-xs text-[var(--brand-strong)] hover:underline">
                    View customer →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ADMIN DISCUSSION */}
          <section className="rounded-md border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Admin discussion</p>
              <p className="text-xs text-gray-400 mt-0.5">Internal comments visible to admins only</p>
            </div>

            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {(order.adminComments || []).length ? (
                order.adminComments.map((comment) => (
                  <article key={comment._id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{comment.author?.name || 'Admin'}</p>
                        <p className="text-[11px] text-gray-400">{format(new Date(comment.createdAt), 'dd/MM/yyyy hh:mm a')}</p>
                      </div>
                    </div>
                    {comment.body && <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.body}</p>}
                    {!!comment.images?.length && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {comment.images.map((image) => (
                          <a
                            key={image._id}
                            href={image.path}
                            target="_blank"
                            rel="noreferrer"
                            className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-50"
                          >
                            <Image src={image.path || '/placeholder.svg'} alt="Admin comment attachment" fill className="object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <p className="p-4 text-sm text-gray-400">No admin comments yet.</p>
              )}
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50/60 space-y-3">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Write an internal comment…"
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--brand)]"
              />
              {!!commentFiles.length && (
                <div className="flex flex-wrap gap-2">
                  {commentFiles.map((item) => (
                    <div key={item.id} className="group relative h-16 w-16 overflow-hidden rounded-md border border-gray-200">
                      <Image src={item.preview} alt={item.file.name} fill className="object-cover" />
                      <button
                        type="button"
                        onClick={() => removeCommentFile(item.id)}
                        className="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex"
                        aria-label="Remove image"
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <input ref={commentFileRef} type="file" accept="image/*" multiple className="hidden" onChange={addCommentFiles} />
                  <button
                    type="button"
                    onClick={() => commentFileRef.current?.click()}
                    disabled={postingComment || commentFiles.length >= 10}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-[var(--brand-ring)] hover:text-[var(--brand-strong)] disabled:opacity-50"
                  >
                    <FiImage /> Add images
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => postComment()}
                  disabled={postingComment || (!commentBody.trim() && !commentFiles.length)}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40"
                >
                  <FiSend /> {postingComment ? 'Posting…' : 'Post comment'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
