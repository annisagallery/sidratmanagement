'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import Link from 'next/link';
import * as api from 'src/services';
import { MdAdd, MdRefresh, MdReport } from 'react-icons/md';
import ComplaintImagePicker from './ComplaintImagePicker';
import PrivateComplaintImage from './PrivateComplaintImage';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable from 'src/components/_admin/ui/DataTable';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import Pagination from 'src/components/_admin/ui/Pagination';
import { fDate, fDateTime } from 'src/utils/formatTime';

const STATUS = {
  open: 'bg-amber-50 text-amber-700 border-amber-100',
  reviewing: 'bg-blue-50 text-blue-700 border-blue-100',
  resolved: 'bg-green-50 text-green-700 border-green-100',
  rejected: 'bg-red-50 text-red-600 border-red-100'
};

const fmtDate = (date) => fDate(date);

function ComplaintPanel({ complaint, onClose }) {
  const qc = useQueryClient();
  const {
    data: detailResponse,
    isLoading: detailLoading,
    isFetching: detailFetching,
    refetch: refetchDetail
  } = useQuery(['admin-complaint', complaint.id], () => api.getComplaintByAdmin(complaint.id), {
    enabled: !!complaint.id,
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });
  const detail = detailResponse?.data || complaint;
  const [form, setForm] = useState({
    status: complaint.status || 'open',
    priority: complaint.priority || 'normal',
    adminNote: complaint.adminNote || '',
    message: ''
  });
  const [replyFiles, setReplyFiles] = useState([]);
  const saveSettings = useMutation(
    () =>
      api.updateComplaintByAdmin({
        id: complaint.id,
        status: form.status,
        priority: form.priority,
        adminNote: form.adminNote
      }),
    {
      onSuccess: () => {
        qc.invalidateQueries('admin-complaints');
        qc.invalidateQueries(['admin-complaint', complaint.id]);
        Swal.fire({
          title: 'Internal settings saved',
          icon: 'success',
          timer: 1100,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      },
      onError: (err) => Swal.fire(err?.response?.data?.message || 'Could not save complaint', '', 'error')
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
      return api.updateComplaintByAdmin({ id: complaint.id, message: form.message, attachmentIds });
    },
    {
      onSuccess: async () => {
        qc.invalidateQueries('admin-complaints');
        setForm((current) => ({ ...current, message: '' }));
        setReplyFiles([]);
        await refetchDetail();
        Swal.fire({
          title: 'Reply sent',
          icon: 'success',
          timer: 1100,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      },
      onError: (err) => Swal.fire(err?.response?.data?.message || 'Could not send reply', '', 'error')
    }
  );

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-end">
      <div className="h-full w-full max-w-xl bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400">Order #{complaint.orderNo}</p>
            <h2 className="text-lg font-bold text-gray-900">{complaint.subject}</h2>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-gray-300 hover:text-gray-700">
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-md border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-900">{complaint.orderItem?.pid?.name || 'Order item'}</p>
            <p className="text-xs text-gray-400 mt-1">
              {complaint.user?.name || 'Customer'} · {complaint.user?.phone || complaint.user?.email || 'No contact'}
            </p>
            <p className="mt-3 text-sm text-gray-600">{complaint.message}</p>
          </div>

          {detailLoading ? (
            <div className="h-24 rounded-md bg-gray-100 animate-pulse" />
          ) : (
            !!detail.attachments?.length && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Private attachments</p>
                <div className="grid grid-cols-3 gap-2">
                  {detail.attachments.map((attachment, attachmentIndex) => (
                    <PrivateComplaintImage
                      key={String(attachment.id || `complaint-attachment-${attachmentIndex}`)}
                      complaintId={detail.id}
                      imageId={attachment.id}
                      alt="Complaint attachment"
                      className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-50"
                    />
                  ))}
                </div>
              </div>
            )
          )}

          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
            >
              {['open', 'reviewing', 'resolved', 'rejected'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
            >
              {['low', 'normal', 'high'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Internal admin note</p>
                <p className="text-[11px] text-amber-700/70">Never visible to the customer</p>
              </div>
              <button
                type="button"
                onClick={() => saveSettings.mutate()}
                disabled={saveSettings.isLoading}
                className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Save settings
              </button>
            </div>
            <textarea
              value={form.adminNote}
              onChange={(e) => setForm((p) => ({ ...p, adminNote: e.target.value }))}
              rows={3}
              placeholder="Add context for other admins…"
              className="w-full border border-amber-200 bg-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="rounded-md border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Customer conversation</p>
              <button
                type="button"
                onClick={() => refetchDetail()}
                disabled={detailFetching}
                className="grid h-8 w-8 place-items-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:border-[var(--brand-ring)] hover:text-[var(--brand-strong)] disabled:opacity-50"
                aria-label="Refresh conversation"
                title="Refresh conversation"
              >
                <MdRefresh size={18} className={detailFetching ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="space-y-4 bg-slate-50/70 p-4 max-h-[420px] overflow-y-auto">
              {(detail.messages || []).map((msg, messageIndex) => {
                const fromAdmin = msg.senderRole !== 'user';
                const messageKey = String(msg.id || `message-${msg.createdAt || messageIndex}-${messageIndex}`);
                return (
                  <div
                    key={messageKey}
                    className={`flex items-end gap-2 ${fromAdmin ? 'justify-end' : 'justify-start'}`}
                  >
                    {!fromAdmin && (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue-100 text-[10px] font-bold text-blue-700">
                        CUS
                      </div>
                    )}
                    <div className={`max-w-[78%] ${fromAdmin ? 'text-right' : ''}`}>
                      <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {fromAdmin ? msg.sender?.name || 'Admin' : detail.user?.name || 'Customer'}
                      </p>
                      <div
                        className={`inline-block rounded-md px-3.5 py-2.5 text-left text-sm shadow-sm ${fromAdmin ? 'rounded-br-md bg-[var(--brand)] text-white' : 'rounded-bl-md border border-gray-200 bg-white text-gray-700'}`}
                      >
                        {msg.message !== 'Attachment' && (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        )}
                        {!!msg.attachments?.length && (
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {msg.attachments.map((attachment, attachmentIndex) => (
                              <PrivateComplaintImage
                                key={String(attachment.id || `${messageKey}-attachment-${attachmentIndex}`)}
                                complaintId={detail.id}
                                imageId={attachment.id}
                                alt="Message attachment"
                                className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100"
                              />
                            ))}
                          </div>
                        )}
                        <p className={`text-[10px] mt-1.5 ${fromAdmin ? 'text-white/60' : 'text-gray-400'}`}>
                          {msg.senderRole} ·{' '}
                          {fDateTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                    {fromAdmin && (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--brand)] text-[10px] font-bold text-white">
                        ADM
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-100 bg-white p-4 space-y-3">
              <ComplaintImagePicker
                files={replyFiles}
                setFiles={setReplyFiles}
                disabled={sendReply.isLoading}
                compact
              />
              <textarea
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                rows={3}
                placeholder="Reply to customer…"
                className="w-full border border-gray-200 rounded-md px-3.5 py-3 text-sm resize-none focus:outline-none focus:border-[var(--brand)]"
              />
              <button
                disabled={sendReply.isLoading || (!form.message.trim() && !replyFiles.length)}
                onClick={() => sendReply.mutate()}
                className="w-full rounded-md bg-[var(--brand)] py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-40"
              >
                {sendReply.isLoading ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComplaintsList() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 20;
  const params = new URLSearchParams({ page, limit, ...(status && { status }), ...(search && { search }) }).toString();
  const { data, isLoading, refetch, isFetching } = useQuery(
    ['admin-complaints', params],
    () => api.getComplaintsByAdmin(params),
    {
      onError: (err) => Swal.fire(err?.response?.data?.message || 'Could not load complains', '', 'error')
    }
  );
  const complaints = data?.data || [];

  const columns = [
    {
      key: 'subject',
      label: 'Subject',
      render: (c) => (
        <>
          <p className="text-[13px] font-semibold text-slate-800">{c.subject}</p>
          <p className="text-xs capitalize text-slate-400">{c.category?.replaceAll('-', ' ')}</p>
        </>
      )
    },
    {
      key: 'orderNo',
      label: 'Order',
      render: (c) => <span className="font-mono text-[13px] text-slate-600">#{c.orderNo}</span>
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (c) => <span className="text-slate-600">{c.user?.name || '—'}</span>
    },
    {
      key: 'item',
      label: 'Item',
      render: (c) => <span className="text-slate-600">{c.orderItem?.pid?.name || '—'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (c) => (
        <span
          className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS[c.status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}
        >
          {c.status}
        </span>
      )
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (c) => <span className="text-xs text-slate-500">{fmtDate(c.createdAt)}</span>
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Complaints" subtitle={`${data?.total || 0} complaint${data?.total === 1 ? '' : 's'}`}>
        <Link href="/orders/complaints/create" className="btn-brand">
          <MdAdd /> Add Complaint
        </Link>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search order, reason, message"
        refreshing={isFetching}
        onRefresh={refetch}
      >
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="select-ui min-w-[140px]"
        >
          <option value="">All status</option>
          {['open', 'reviewing', 'resolved', 'rejected'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable
        columns={columns}
        data={complaints}
        isLoading={isLoading}
        onRowClick={(c) => setSelected(c)}
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
    </div>
  );
}
