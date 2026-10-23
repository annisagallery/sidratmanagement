'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import * as api from 'src/services';
import { usePermissions } from 'src/context/PermissionsContext';
import { toastError, toastSuccess } from 'src/utils/swal';
import { Drawer } from 'src/components/_admin/ui/primitives';
import ComplaintImagePicker from '../orders/ComplaintImagePicker';

const categories = ['quality', 'wrong-item', 'damaged', 'missing-item', 'delivery', 'other'];
const itemName = (item) => item.pid?.name || item.productSnapshot?.name || 'Order product';

export default function CreateComplaint({ onClose }) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [selected, setSelected] = useState([]);
  const [created, setCreated] = useState([]);
  const [files, setFiles] = useState([]);
  const [failures, setFailures] = useState([]);
  const [form, setForm] = useState({ category: 'other', priority: 'normal', message: '', adminNote: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const lookup = useMutation((number) => api.getOrderByAdmin(encodeURIComponent(number)), {
    onMutate: () => { setOrder(null); setSelected([]); setCreated([]); setFailures([]); },
    onSuccess: (response) => setOrder(response?.data || null)
  });
  const create = useMutation(async ({ items, fields, attachments }) => {
    const succeeded = [];
    const failed = [];
    // Each product has its own complaint; retain successes if another fails.
    for (const item of items) {
      try {
        let attachmentIds = [];
        if (attachments.length) {
          const data = new FormData();
          attachments.forEach((entry) => data.append('files', entry.file));
          const uploaded = await api.uploadComplaintImagesByAdmin(data);
          attachmentIds = (uploaded.data || []).map((image) => image.id);
        }
        await api.createComplaintByAdmin({ ...fields, orderItemId: item.id, attachmentIds });
        succeeded.push(item.id);
      } catch (error) {
        failed.push({ id: item.id, name: itemName(item), message: error?.response?.data?.message || 'Could not create complaint. Please try again.' });
      }
    }
    return { succeeded, failed };
  }, {
    onSuccess: ({ succeeded, failed }) => {
      setFailures(failed);
      setCreated((current) => [...current, ...succeeded]);
      setSelected((current) => current.filter((id) => !succeeded.includes(id)));
      if (succeeded.length) {
        queryClient.invalidateQueries('complaints');
        toastSuccess(`${succeeded.length} complaint${succeeded.length === 1 ? '' : 's'} created`);
      }
      if (!failed.length) onClose();
    },
    onError: (error) => toastError(error, 'Could not create complaints')
  });
  const eligible = order && ['delivered', 'completed'].includes(order.status);
  const items = order?.items || [];
  const lookupError = lookup.error?.response?.data?.message || 'Could not find this order. Check the order number and try again.';

  if (!can('create', 'Complaint')) {
    return <p role="alert" className="card-ui p-5 text-sm text-slate-600">You do not have permission to create complaints.</p>;
  }

  return (
    <Drawer title="Create complaint" subtitle="Find an order and select products" onClose={create.isLoading ? () => {} : onClose} width="max-w-2xl">
      <div className="space-y-5">
      <form className="card-ui space-y-3 p-5" onSubmit={(event) => {
        event.preventDefault();
        const number = orderNumber.trim().replace(/^#\s*/, '');
        if (number) lookup.mutate(number);
      }}>
        <label htmlFor="complaint-order-number" className="block text-sm font-semibold text-slate-700">Order number</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="complaint-order-number" className="input-ui min-h-11 flex-1" placeholder="Enter order number" required
            value={orderNumber} disabled={lookup.isLoading || create.isLoading}
            aria-describedby={lookup.isError ? 'complaint-order-error' : undefined}
            aria-invalid={lookup.isError}
            onChange={(event) => { setOrderNumber(event.target.value); setOrder(null); setSelected([]); setCreated([]); setFiles([]); setFailures([]); lookup.reset(); }} />
          <button type="submit" className="btn-brand min-h-11" disabled={!orderNumber.trim() || lookup.isLoading || create.isLoading}>
            {lookup.isLoading ? 'Finding order…' : 'Find order'}
          </button>
        </div>
        {lookup.isError && <p id="complaint-order-error" role="alert" className="text-sm text-rose-700">{lookupError}</p>}
        {lookup.isSuccess && !order && <p role="status" className="text-sm text-slate-600">No order found. Check the order number and try again.</p>}
      </form>

      {order && <form className="card-ui space-y-5 p-5" onSubmit={(event) => {
        event.preventDefault();
        if (!eligible || !selected.length || !form.message.trim() || create.isLoading) return;
        create.mutate({ items: items.filter((item) => selected.includes(item.id)), fields: { ...form, message: form.message.trim() }, attachments: files });
      }}>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Order #{order.orderNo}</h2>
          <p className="mt-1 text-sm capitalize text-slate-500">{order.user?.name || order.customer?.name || order.name || 'Customer'} · {order.status}</p>
        </div>
        {!eligible ? <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Complaints can only be opened for delivered or completed orders.</p> : !items.length ? <p role="status" className="text-sm text-slate-600">This order has no products to report.</p> : <>
          <fieldset disabled={create.isLoading} className="space-y-4">
            <legend className="mb-3 text-sm font-semibold text-slate-700">Select products</legend>
            <p className="text-sm text-slate-500">A separate complaint will be created for each selected product.</p>
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {items.map((item) => <label key={item.id} className="flex min-h-16 cursor-pointer items-start gap-3 p-4 hover:bg-slate-50">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-strong)]" checked={selected.includes(item.id)} disabled={created.includes(item.id)}
                  onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                <span className="min-w-0 text-sm"><span className="block font-medium text-slate-900">{itemName(item)}</span>
                  {created.includes(item.id) && <span className="block text-emerald-700">Complaint created</span>}
                  <span className="mt-1 block text-slate-500">{(item.attributes || []).map((attribute) => attribute.valueName).filter(Boolean).join(' / ')}{item.packingBarcode ? ` · ${item.packingBarcode}` : ''} · Qty {item.quantity || 1}</span>
                </span>
              </label>)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">Category
                <select className="select-ui mt-1.5 min-h-11 w-full" value={form.category} onChange={set('category')}>
                  {categories.map((category) => <option key={category} value={category}>{category.replaceAll('-', ' ')}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">Priority
                <select className="select-ui mt-1.5 min-h-11 w-full" value={form.priority} onChange={set('priority')}>
                  {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Complaint details
              <textarea className="input-ui mt-1.5 min-h-32 py-2" value={form.message} onChange={set('message')} required />
            </label>
            {can('update', 'Complaint') && <ComplaintImagePicker files={files} setFiles={setFiles} disabled={create.isLoading} />}
            <label className="block text-sm font-semibold text-slate-700">Internal note
              <textarea className="input-ui mt-1.5 min-h-20 py-2" value={form.adminNote} onChange={set('adminNote')} />
              <span className="mt-1 block text-xs font-normal text-slate-500">Visible to staff only.</span>
            </label>
          </fieldset>
          {Boolean(failures.length) && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <p className="font-semibold">Some complaints could not be created</p>
            <ul className="mt-2 list-inside list-disc">{failures.map((failure) => <li key={failure.id}>{failure.name}: {failure.message}</li>)}</ul>
          </div>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost min-h-11" onClick={onClose} disabled={create.isLoading}>Cancel</button>
            <button type="submit" className="btn-brand min-h-11" disabled={create.isLoading || !selected.length || !form.message.trim()}>
              {create.isLoading ? 'Creating…' : `Create complaint${selected.length > 1 ? 's' : ''}${selected.length ? ` (${selected.length})` : ''}`}
            </button>
          </div>
        </>}
      </form>}
    </div>
    </Drawer>
  );
}
