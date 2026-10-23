'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { MdAdd, MdClose, MdRefresh, MdReport } from 'react-icons/md';

import * as api from 'src/services';
import { usePermissions } from 'src/context/PermissionsContext';
import { alertError, toastError, toastSuccess } from 'src/utils/swal';
import { fDate, fDateTime } from 'src/utils/formatTime';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import ComplaintImagePicker from '../orders/ComplaintImagePicker';
import PrivateComplaintImage from './PrivateComplaintImage';
import CreateComplaint from './CreateComplaint';

const STATUS_STYLES = {
  open: 'border-amber-100 bg-amber-50 text-amber-700',
  reviewing: 'border-blue-100 bg-blue-50 text-blue-700',
  resolved: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-100 bg-rose-50 text-rose-700'
};

function ComplaintPanel({ complaint, onClose }) {
  const { can } = usePermissions();
  const canUpdate = can('update', 'Complaint');
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    status: complaint.status || 'open',
    priority: complaint.priority || 'normal',
    adminNote: complaint.adminNote || '',
    message: ''
  });
  const [replyFiles, setReplyFiles] = useState([]);
  const {
    data: response,
    isLoading,
    isFetching,
    refetch
  } = useQuery(['complaint', complaint.id], () => api.getComplaint(complaint.id), {
    enabled: Boolean(complaint.id),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    onError: (error) => alertError(error, { title: "Couldn't load complaint details" })
  });
  const detail = response?.data || complaint;

  const refreshLists = () => queryClient.invalidateQueries('complaints');

  const saveSettings = useMutation(
    () => api.updateComplaint({
      id: complaint.id,
      status: form.status,
      priority: form.priority,
      adminNote: form.adminNote
    }),
    {
      onSuccess: async () => {
        refreshLists();
        await queryClient.invalidateQueries(['complaint', complaint.id]);
        toastSuccess('Complaint settings saved');
      },
      onError: (error) => toastError(error, 'Could not save complaint')
    }
  );

  const sendReply = useMutation(
    async () => {
      let attachmentIds = [];
      if (replyFiles.length) {
        const data = new FormData();
        replyFiles.forEach((entry) => data.append('files', entry.file));
        const uploaded = await api.uploadComplaintImagesByAdmin(data);
        attachmentIds = (uploaded.data || []).map((image) => image.id);
      }
      return api.updateComplaint({ id: complaint.id, message: form.message, attachmentIds });
    },
    {
      onSuccess: async () => {
        refreshLists();
        setForm((current) => ({ ...current, message: '' }));
        setReplyFiles([]);
        await refetch();
        toastSuccess('Reply sent');
      },
      onError: (error) => toastError(error, 'Could not send reply')
    }
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Complaint details">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close complaint details" />
      <section className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <p className="text-xs text-slate-400">Order #{complaint.orderNo}</p>
            <h2 className="text-lg font-bold text-slate-900">{complaint.subject}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close complaint details">
            <MdClose size={20} />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div className="rounded-md border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-900">{complaint.orderItem?.pid?.name || 'Order item'}</p>
            <p className="mt-1 text-xs text-slate-400">
              {complaint.user?.name || 'Customer'} · {complaint.user?.phone || complaint.user?.email || 'No contact'}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{complaint.message}</p>
          </div>

          {isLoading ? (
            <div className="h-24 animate-pulse rounded-md bg-slate-100" />
          ) : (
            Boolean(detail.attachments?.length) && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Private attachments</p>
                <div className="grid grid-cols-3 gap-2">
                  {detail.attachments.map((attachment, index) => (
                    <PrivateComplaintImage
                      key={attachment.id || `attachment-${index}`}
                      complaintId={detail.id}
                      imageId={attachment.id}
                      alt="Complaint attachment"
                      className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                    />
                  ))}
                </div>
              </div>
            )
          )}

          <fieldset disabled={!canUpdate} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="select-ui mt-1.5 w-full normal-case"
              >
                {['open', 'reviewing', 'resolved', 'rejected'].map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Priority
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                className="select-ui mt-1.5 w-full normal-case"
              >
                {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </label>
          </fieldset>

          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Internal note</p>
                <p className="text-[11px] text-amber-700/70">Never visible to the customer</p>
              </div>
              <button type="button" onClick={() => saveSettings.mutate()} disabled={!canUpdate || saveSettings.isLoading} className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                {saveSettings.isLoading ? 'Saving…' : 'Save settings'}
              </button>
            </div>
            <textarea
              disabled={!canUpdate}
              value={form.adminNote}
              onChange={(event) => setForm((current) => ({ ...current, adminNote: event.target.value }))}
              rows={3}
              placeholder="Add context for other agents…"
              className="w-full resize-none rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Customer conversation</p>
              <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-icon" aria-label="Refresh conversation">
                <MdRefresh size={18} className={isFetching ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="max-h-[420px] space-y-4 overflow-y-auto bg-slate-50/70 p-4">
              {(detail.messages || []).map((message, messageIndex) => {
                const fromAgent = message.senderRole !== 'user';
                const messageKey = message.id || `${message.createdAt}-${messageIndex}`;
                return (
                  <div key={messageKey} className={`flex items-end gap-2 ${fromAgent ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] ${fromAgent ? 'text-right' : ''}`}>
                      <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {fromAgent ? message.sender?.name || 'Agent' : detail.user?.name || 'Customer'}
                      </p>
                      <div className={`inline-block rounded-md px-3.5 py-2.5 text-left text-sm shadow-sm ${fromAgent ? 'bg-[var(--brand)] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                        {message.message !== 'Attachment' && <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>}
                        {Boolean(message.attachments?.length) && (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {message.attachments.map((attachment, index) => (
                              <PrivateComplaintImage
                                key={attachment.id || `${messageKey}-attachment-${index}`}
                                complaintId={detail.id}
                                imageId={attachment.id}
                                alt="Message attachment"
                                className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                              />
                            ))}
                          </div>
                        )}
                        <p className={`mt-1.5 text-[10px] ${fromAgent ? 'text-white/60' : 'text-slate-400'}`}>{fDateTime(message.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <fieldset disabled={!canUpdate} className="space-y-3 border-t border-slate-100 bg-white p-4">
              <ComplaintImagePicker files={replyFiles} setFiles={setReplyFiles} disabled={sendReply.isLoading} />
              <textarea
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                rows={3}
                placeholder="Reply to customer…"
                className="input-ui min-h-24 resize-none py-3"
              />
              <button
                type="button"
                disabled={sendReply.isLoading || (!form.message.trim() && !replyFiles.length)}
                onClick={() => sendReply.mutate()}
                className="btn-brand w-full justify-center disabled:opacity-40"
              >
                {sendReply.isLoading ? 'Sending…' : 'Send reply'}
              </button>
            </fieldset>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ComplaintsWorkspace() {
  const { can } = usePermissions();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  const params = { page, limit, ...(status && { status }), ...(search && { search }) };
  const { data, isLoading, isFetching, error, refetch } = useQuery(
    ['complaints', params],
    () => api.getComplaints(params),
    { enabled: can('read', 'Complaint'), keepPreviousData: true, onError: (error) => alertError(error, { title: "Couldn't load complaints" }) }
  );
  const complaints = data?.data || [];

  if (!can('read', 'Complaint')) {
    return <p role="alert" className="card-ui p-5 text-sm text-slate-600">You do not have permission to view complaints.</p>;
  }

  const columns = [
    {
      key: 'subject',
      label: 'Subject',
      render: (complaint) => (
        <>
          <p className="text-[13px] font-semibold text-slate-800">{complaint.subject}</p>
          <p className="text-xs capitalize text-slate-400">{complaint.category?.replaceAll('-', ' ')}</p>
        </>
      )
    },
    { key: 'orderNo', label: 'Order', render: (complaint) => <span className="font-mono text-[13px]">#{complaint.orderNo}</span> },
    { key: 'customer', label: 'Customer', render: (complaint) => complaint.user?.name || '—' },
    { key: 'item', label: 'Item', render: (complaint) => complaint.orderItem?.pid?.name || '—' },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (complaint) => (
        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[complaint.status] || 'border-slate-100 bg-slate-50 text-slate-600'}`}>
          {complaint.status}
        </span>
      )
    },
    { key: 'createdAt', label: 'Date', render: (complaint) => <span className="text-xs text-slate-500">{fDate(complaint.createdAt)}</span> }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Complaints" subtitle={`${data?.total || 0} complaint${data?.total === 1 ? '' : 's'}`}>
        {can('create', 'Complaint') && <button type="button" onClick={() => setCreateOpen(true)} className="btn-brand">
          <MdAdd size={17} /> Create complaint
        </button>}
      </PageHeader>
      <ListToolbar
        search={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        searchPlaceholder="Search order, reason, or message"
        refreshing={isFetching}
        onRefresh={refetch}
      >
        <select
          value={status}
          onChange={(event) => { setStatus(event.target.value); setPage(1); }}
          className="select-ui min-w-[140px]"
        >
          <option value="">All statuses</option>
          {['open', 'reviewing', 'resolved', 'rejected'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </ListToolbar>
      <DataTable
        columns={columns}
        data={complaints}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        onRowClick={setSelected}
        empty={<EmptyState title="No complaints found" icon={MdReport} />}
        footer={
          <Pagination
            page={page}
            totalPages={data?.count || 1}
            onPage={setPage}
            total={data?.total || 0}
            unit="complaints"
            pageSize={limit}
          />
        }
      />
      {selected && <ComplaintPanel complaint={selected} onClose={() => setSelected(null)} />}
      {createOpen && <CreateComplaint onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
