'use client';

/**
 * The four things an operator can change from the order screen: take money,
 * correct the order's details, hand it to a courier, and open a complaint.
 *
 * Each is a modal rather than an inline form because each is a decision the
 * operator commits to — the page behind stays readable as the reference while
 * the form is filled in. Problems with the input are said under the field that
 * has them, not in a pop-up that hides the form.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { FiAlertTriangle, FiMapPin, FiTruck } from 'react-icons/fi';

import * as api from 'src/services';
import ComplaintImagePicker from 'src/components/_admin/orders/ComplaintImagePicker';
import { escapeHtml } from 'src/utils/swal';
import {
  Field,
  ModalShell,
  Notice,
  PROVIDER_LABEL,
  errorAlert,
  fieldClass,
  selectClass,
  money,
  normalizeList,
  oid,
  tagId,
  tagName,
  toast
} from './parts';

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

function CancelButton({ onClose, disabled }) {
  return (
    <button type="button" onClick={onClose} disabled={disabled} className="btn-ghost">
      Cancel
    </button>
  );
}

function SubmitButton({ onClick, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn-brand">
      {children}
    </button>
  );
}

/** A titled group of fields inside a modal. */
function FieldGroup({ title, children }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-sm font-semibold text-slate-900">{title}</legend>
      {children}
    </fieldset>
  );
}

/* ── payment ─────────────────────────────────────────────────────────────── */

export function AddPaymentModal({ orderNo, due, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    method: 'cash',
    amount: due > 0 ? String(due) : '',
    trxId: '',
    note: ''
  });
  const [errors, setErrors] = useState({});
  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const { data: typesData } = useQuery(['payment-types'], api.getPaymentTypesByAdmin, { staleTime: 5 * 60_000 });
  const configuredMethods = normalizeList(typesData)
    .filter((type) => type.isActive !== false)
    .map((type) => ({ value: type.slug || type.name || type.label, label: type.name || type.label || type.slug }))
    .filter((type) => type.value);
  const methods = configuredMethods.some((type) => type.value === 'cash')
    ? configuredMethods
    : [{ value: 'cash', label: 'Cash' }, ...configuredMethods];

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
        queryClient.invalidateQueries(['payments']);
        toast('Payment recorded');
        onSaved();
      },
      onError: (error) => errorAlert('Could not add payment', error)
    }
  );

  const submit = () => {
    const next = {};
    if (!form.method.trim()) next.method = 'Choose or type a payment method.';
    if (!(Number(form.amount) > 0)) next.amount = 'Enter an amount greater than zero.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate();
  };

  return (
    <ModalShell
      title="Record a payment"
      subtitle={`Order #${orderNo}`}
      onClose={onClose}
      footer={
        <>
          <CancelButton onClose={onClose} disabled={save.isLoading} />
          <SubmitButton onClick={submit} disabled={save.isLoading}>
            {save.isLoading ? 'Saving…' : 'Record payment'}
          </SubmitButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Method" required error={errors.method}>
          <input
            list="order-payment-methods"
            className={fieldClass}
            value={form.method}
            onChange={(event) => set('method', event.target.value)}
            aria-invalid={Boolean(errors.method)}
          />
          <datalist id="order-payment-methods">
            {methods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </datalist>
        </Field>
        <Field
          label="Amount (৳)"
          required
          error={errors.amount}
          hint={due > 0 ? `${money(due)} still due` : 'Nothing outstanding'}
          showHint
        >
          <input
            type="number"
            inputMode="decimal"
            min="0"
            className={fieldClass}
            value={form.amount}
            onChange={(event) => set('amount', event.target.value)}
            aria-invalid={Boolean(errors.amount)}
          />
        </Field>
        <Field label="Transaction ID" optional className="sm:col-span-2">
          <input
            className={`${fieldClass} ops-code`}
            value={form.trxId}
            onChange={(event) => set('trxId', event.target.value)}
            placeholder="bKash / Nagad / bank reference"
            spellCheck={false}
          />
        </Field>
        <Field label="Note" optional className="sm:col-span-2">
          <input className={fieldClass} value={form.note} onChange={(event) => set('note', event.target.value)} />
        </Field>
      </div>
    </ModalShell>
  );
}

/* ── order details ───────────────────────────────────────────────────────── */

export function EditDetailsModal({ order, orderNo, onClose, onSaved }) {
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

  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setAddress = (key, value) =>
    setDraft((current) => ({ ...current, shippingAddress: { ...current.shippingAddress, [key]: value } }));

  const { data: orderTags = [] } = useQuery(
    ['orderTags'],
    async () => {
      if (typeof api.getOrderTagsByAdmin !== 'function') return [];
      return normalizeList(await api.getOrderTagsByAdmin());
    },
    { staleTime: 5 * 60_000 }
  );

  /**
   * Tags are typed as names but stored as ids. Without a loaded tag list there
   * is no safe mapping, so an untouched field keeps what the order already had
   * rather than clearing it.
   */
  function resolveTags() {
    const tokens = String(draft.tags || '')
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);

    if (!orderTags.length) {
      const currentNames = (order.tags || []).map(tagName).filter(Boolean).join(', ');
      return draft.tags === currentNames ? (order.tags || []).map(tagId).filter(Boolean) : [];
    }

    const byName = new Map(orderTags.map((tag) => [String(tagName(tag)).toLowerCase(), tagId(tag)]));
    const ids = new Set(orderTags.map((tag) => tagId(tag)));
    return tokens.map((token) => (ids.has(token) ? token : byName.get(token.toLowerCase()))).filter(Boolean);
  }

  const save = useMutation(
    () =>
      api.updateOrderStatus({
        id: orderNo,
        ...draft,
        shipping: Number(draft.shipping || 0),
        discount: Number(draft.discount || 0),
        estimatedDelivery: draft.estimatedDelivery || null,
        tags: resolveTags()
      }),
    {
      onSuccess: () => {
        toast('Order details saved');
        onSaved();
      },
      onError: (error) => errorAlert('Could not save changes', error, 'Please check the fields and try again.')
    }
  );

  return (
    <ModalShell
      title="Edit order details"
      subtitle={`Order #${orderNo}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <CancelButton onClose={onClose} disabled={save.isLoading} />
          <SubmitButton onClick={() => save.mutate()} disabled={save.isLoading}>
            {save.isLoading ? 'Saving…' : 'Save changes'}
          </SubmitButton>
        </>
      }
    >
      <div className="space-y-8">
        <FieldGroup title="Delivery address">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Recipient">
              <input className={fieldClass} value={draft.shippingAddress.name} onChange={(e) => setAddress('name', e.target.value)} />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                className={fieldClass}
                value={draft.shippingAddress.phone}
                onChange={(e) => setAddress('phone', e.target.value)}
              />
            </Field>
            <Field label="District">
              <input className={fieldClass} value={draft.shippingAddress.district} onChange={(e) => setAddress('district', e.target.value)} />
            </Field>
            <Field label="Upazila">
              <input className={fieldClass} value={draft.shippingAddress.upazila} onChange={(e) => setAddress('upazila', e.target.value)} />
            </Field>
            <Field label="Area" className="sm:col-span-2">
              <input className={fieldClass} value={draft.shippingAddress.area} onChange={(e) => setAddress('area', e.target.value)} />
            </Field>
            <Field label="Street address" className="sm:col-span-2">
              <textarea
                rows={2}
                className={`${fieldClass} resize-none`}
                value={draft.shippingAddress.address}
                onChange={(e) => setAddress('address', e.target.value)}
              />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup title="Charges and handling">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Shipping charge (৳)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                className={fieldClass}
                value={draft.shipping}
                onChange={(e) => setField('shipping', e.target.value)}
              />
            </Field>
            <Field label="Discount (৳)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                className={fieldClass}
                value={draft.discount}
                onChange={(e) => setField('discount', e.target.value)}
              />
            </Field>
            <Field label="Payment method">
              <input className={fieldClass} value={draft.paymentMethod} onChange={(e) => setField('paymentMethod', e.target.value)} />
            </Field>
            <Field label="Delivery type">
              <select className={selectClass} value={draft.deliveryType} onChange={(e) => setField('deliveryType', e.target.value)}>
                <option value="regular">Regular</option>
                <option value="urgent">Urgent</option>
                <option value="sameDay">Same day</option>
              </select>
            </Field>
            <Field label="Estimated delivery">
              <input
                type="date"
                className={fieldClass}
                value={draft.estimatedDelivery}
                onChange={(e) => setField('estimatedDelivery', e.target.value)}
              />
            </Field>
            <Field label="Tags" hint="Separate with commas" showHint>
              <input className={fieldClass} value={draft.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="priority, gift, fragile" />
            </Field>
            <Field label="Customer note" optional className="sm:col-span-2">
              <textarea rows={2} className={`${fieldClass} resize-none`} value={draft.note} onChange={(e) => setField('note', e.target.value)} />
            </Field>
          </div>
        </FieldGroup>
      </div>
    </ModalShell>
  );
}

/* ── courier ─────────────────────────────────────────────────────────────── */

export function ShipModal({ orderNo, order, meta, isResend, onClose, onSent }) {
  const { data: optionsData, isLoading: loadingOptions } = useQuery(['courier-options'], api.getCourierOptions, {
    staleTime: 60_000
  });
  const options = normalizeList(optionsData);
  const defaultAccount = options.find((option) => option.isDefault) || options[0];

  const [form, setForm] = useState({
    accountId: '',
    codAmount: String(meta?.suggestedCod ?? ''),
    weight: '0.5',
    itemQuantity: String((order.items || []).length || 1),
    deliveryType: '48',
    note: ''
  });
  const [accountError, setAccountError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  // The default account is derived rather than written into state on load, so
  // the form is correct on its first render instead of one render later.
  const accountId = form.accountId || oid(defaultAccount);
  const selected = options.find((option) => oid(option) === accountId);
  const address = order.shippingAddress || {};

  const send = useMutation(
    () =>
      api.createOrderShipment({
        orderNo,
        accountId,
        codAmount: Number(form.codAmount) || 0,
        weight: Number(form.weight) || 0.5,
        itemQuantity: Number(form.itemQuantity) || 1,
        deliveryType: form.deliveryType,
        note: form.note.trim()
      }),
    {
      onSuccess: (response) => {
        toast(response?.message || 'Shipment created');
        onSent(response);
      },
      onError: (error) => {
        const message = error?.response?.data?.message || 'The courier rejected the request.';
        const providerError = error?.response?.data?.providerError;
        // The courier's raw reply is shown as-is, because it is what support
        // asks for; the operator's message leads.
        Swal.fire({
          title: 'Could not send the parcel',
          html: `<p style="margin:0">${escapeHtml(message)}</p>${
            providerError
              ? `<pre style="margin:12px 0 0;max-height:10rem;overflow:auto;border-radius:8px;background:#f1f5f9;padding:8px;text-align:left;font-size:12px">${escapeHtml(
                  JSON.stringify(providerError, null, 2)
                )}</pre>`
              : ''
          }`,
          icon: 'error'
        });
      }
    }
  );

  const submit = () => {
    if (!accountId) {
      setAccountError('Choose the courier account to book with.');
      return;
    }
    send.mutate();
  };

  const fullAddress = [address.address, address.area, address.upazila, address.district].filter(Boolean).join(', ');

  return (
    <ModalShell
      title={isResend ? 'Re-send parcel' : 'Send parcel to courier'}
      subtitle={`Order #${orderNo}`}
      onClose={onClose}
      footer={
        <>
          <CancelButton onClose={onClose} disabled={send.isLoading} />
          <SubmitButton onClick={submit} disabled={send.isLoading || !options.length}>
            <FiTruck size={16} aria-hidden /> {send.isLoading ? 'Sending…' : isResend ? 'Re-send parcel' : 'Send parcel'}
          </SubmitButton>
        </>
      }
    >
      <div className="space-y-5">
        {isResend ? (
          <Notice tone="warn" icon={FiAlertTriangle} title="This creates a new consignment">
            The previous parcel was cancelled or returned. It stays in the shipment history.
          </Notice>
        ) : null}

        <div className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <FiMapPin size={17} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {address.name || 'No recipient'} · {address.phone || 'No phone'}
            </p>
            <p className="mt-0.5 text-[13px] text-slate-600">{fullAddress || 'No address on this order'}</p>
            <p className="mt-1 text-xs text-slate-500">Wrong address? Close this and use “Edit details & address” first.</p>
          </div>
        </div>

        {loadingOptions ? (
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-9 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton h-9" />
              <div className="skeleton h-9" />
            </div>
          </div>
        ) : !options.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-slate-900">No active courier accounts</p>
            <p className="mt-1 text-[13px] text-slate-500">Add one before booking a parcel.</p>
            <Link href="/shipping/couriers" className="btn-ghost btn-sm mt-4">
              Open courier accounts
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Courier account" required error={accountError} className="sm:col-span-2">
              <select
                className={selectClass}
                value={accountId}
                onChange={(e) => {
                  set('accountId', e.target.value);
                  setAccountError('');
                }}
              >
                {options.map((option) => (
                  <option key={oid(option)} value={oid(option)}>
                    {PROVIDER_LABEL[option.provider] || option.provider} — {option.name}
                    {option.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Cash to collect (৳)"
              hint={meta?.suggestedCod ? `Suggested ${money(meta.suggestedCod)}` : undefined}
              showHint
            >
              <input
                type="number"
                inputMode="decimal"
                min="0"
                className={fieldClass}
                value={form.codAmount}
                onChange={(e) => set('codAmount', e.target.value)}
              />
            </Field>
            <Field label="Item quantity">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                className={fieldClass}
                value={form.itemQuantity}
                onChange={(e) => set('itemQuantity', e.target.value)}
              />
            </Field>
            {selected?.provider === 'pathao' ? (
              <>
                <Field label="Weight (kg)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    max="10"
                    step="0.5"
                    className={fieldClass}
                    value={form.weight}
                    onChange={(e) => set('weight', e.target.value)}
                  />
                </Field>
                <Field label="Delivery speed">
                  <select className={selectClass} value={form.deliveryType} onChange={(e) => set('deliveryType', e.target.value)}>
                    <option value="48">Normal (48h)</option>
                    <option value="12">On-demand (12h)</option>
                  </select>
                </Field>
              </>
            ) : null}
            <Field label="Note to courier" optional className="sm:col-span-2">
              <input
                className={fieldClass}
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder="e.g. Fragile — call before delivery"
              />
            </Field>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* ── complaint ───────────────────────────────────────────────────────────── */

export function ComplaintModal({ item, order, onClose, onSubmitted }) {
  const [form, setForm] = useState({ category: 'other', priority: 'normal', message: '', adminNote: '' });
  const [files, setFiles] = useState([]);
  const [messageError, setMessageError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const create = useMutation(
    async (payload) => {
      let attachmentIds = [];
      if (files.length) {
        const data = new FormData();
        files.forEach((entry) => data.append('files', entry.file));
        const uploaded = await api.uploadComplaintImagesByAdmin(data);
        attachmentIds = (uploaded.data || []).map((image) => oid(image));
      }
      return api.createComplaintByAdmin({ ...payload, attachmentIds });
    },
    {
      onSuccess: () => {
        toast('Complaint opened for this item');
        onSubmitted();
      },
      onError: (error) => errorAlert('Could not create complaint', error)
    }
  );

  const productName = item.pid?.name || item.productSnapshot?.name || 'order item';

  const submit = () => {
    if (!form.message.trim()) {
      setMessageError('Describe what the customer reported.');
      return;
    }
    create.mutate({ ...form, orderItemId: oid(item) });
  };

  return (
    <ModalShell
      title="Open a complaint"
      subtitle={`Order #${order.orderNo} · ${productName}`}
      onClose={onClose}
      footer={
        <>
          <CancelButton onClose={onClose} disabled={create.isLoading} />
          <SubmitButton onClick={submit} disabled={create.isLoading}>
            {create.isLoading ? 'Saving…' : 'Open complaint'}
          </SubmitButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select className={selectClass} value={form.category} onChange={(e) => set('category', e.target.value)}>
              {COMPLAINT_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={selectClass} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
        </div>
        <Field label="What the customer reported" required error={messageError}>
          <textarea
            rows={4}
            className={`${fieldClass} resize-none`}
            value={form.message}
            onChange={(e) => {
              set('message', e.target.value);
              setMessageError('');
            }}
            placeholder="Write the complaint in the customer's words"
            aria-invalid={Boolean(messageError)}
          />
        </Field>
        <ComplaintImagePicker files={files} setFiles={setFiles} disabled={create.isLoading} />
        <Field label="Internal note" optional hint="Visible to admins only" showHint>
          <textarea
            rows={2}
            className={`${fieldClass} resize-none`}
            value={form.adminNote}
            onChange={(e) => set('adminNote', e.target.value)}
          />
        </Field>
      </div>
    </ModalShell>
  );
}
