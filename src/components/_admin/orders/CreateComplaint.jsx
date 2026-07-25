'use client';

import { useState } from 'react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { createComplaintByAdmin } from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';

const categories = ['quality', 'wrong-item', 'damaged', 'missing-item', 'delivery', 'other'];

export default function CreateComplaint() {
  const router = useRouter();
  const [form, setForm] = useState({ orderItemId: '', category: 'other', priority: 'normal', message: '', adminNote: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const create = useMutation(createComplaintByAdmin, {
    onSuccess: () => {
      toast.success('Complaint created');
      router.push('/orders/complaints');
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not create complaint')
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Create complaint" subtitle="Complaints can only be opened for completed order items." />
      <form
        className="card-ui space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(form);
        }}
      >
        <label className="block text-sm font-semibold text-slate-700">
          Order item ID
          <input className="input-ui mt-1.5" value={form.orderItemId} onChange={set('orderItemId')} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Category
            <select className="select-ui mt-1.5 w-full" value={form.category} onChange={set('category')}>
              {categories.map((category) => <option key={category} value={category}>{category.replaceAll('-', ' ')}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Priority
            <select className="select-ui mt-1.5 w-full" value={form.priority} onChange={set('priority')}>
              {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Complaint details
          <textarea className="input-ui mt-1.5 min-h-32 py-2" value={form.message} onChange={set('message')} required />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Internal note
          <textarea className="input-ui mt-1.5 min-h-20 py-2" value={form.adminNote} onChange={set('adminNote')} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => router.push('/orders/complaints')}>Cancel</button>
          <button type="submit" className="btn-brand" disabled={create.isLoading}>{create.isLoading ? 'Creating…' : 'Create complaint'}</button>
        </div>
      </form>
    </div>
  );
}
