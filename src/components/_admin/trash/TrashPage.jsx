'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { FiTrash2, FiRotateCcw } from 'react-icons/fi';

import * as api from 'src/services';
import useAdminUserStore from 'src/stores/userStore';
import DataTable from 'src/components/_admin/ui/DataTable';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import Pagination from 'src/components/_admin/ui/Pagination';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { fDateTime } from 'src/utils/formatTime';
import { isSuperAdmin } from 'src/utils/adminRole';
import { alertError, confirmAction, toastSuccess } from 'src/utils/swal';

const fmtDateTime = (date) => (date ? fDateTime(date) : '—');

/**
 * Super-admin recycle bin: everything soft-deleted anywhere in the system,
 * browsable per model, searchable, restorable. Restored records keep any
 * inactive/hidden flag their delete set — restoring never re-publishes.
 */
export default function TrashPage() {
  const qc = useQueryClient();
  const { user } = useAdminUserStore();
  const [model, setModel] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const hasSuperAdminAccess = isSuperAdmin(user);

  const { data: summaryData } = useQuery('trash-summary', api.getTrashSummary, { enabled: hasSuperAdminAccess });
  const models = summaryData?.data || [];
  const totalDeleted = models.reduce((sum, m) => sum + m.count, 0);

  const params = new URLSearchParams({ model, page, limit, ...(search && { search }) }).toString();
  const { data, isLoading, isFetching } = useQuery(['trash-items', params], () => api.getTrashItems(params), {
    enabled: hasSuperAdminAccess,
    keepPreviousData: true,
    onError: (error) => alertError(error, { title: "Couldn't open the recycle bin" })
  });

  const items = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.count || 1;

  const restoreMut = useMutation(api.restoreTrashItem, {
    onSuccess: (res) => {
      toastSuccess(res?.message || 'Restored');
      qc.invalidateQueries('trash-items');
      qc.invalidateQueries('trash-summary');
    },
    onError: (error) => alertError(error, { title: "Couldn't restore that item" })
  });

  const confirmRestore = async (item) => {
    const confirmed = await confirmAction({
      title: 'Restore this item?',
      subject: `${item.title} · ${item.modelLabel}`,
      text: 'If the delete also hid it, it comes back hidden — re-enable it from its own page.',
      confirmText: 'Restore'
    });
    if (confirmed) restoreMut.mutate({ model: item.model, id: item.id });
  };

  const refreshTrash = () => {
    qc.invalidateQueries('trash-items');
    qc.invalidateQueries('trash-summary');
  };

  if (!isSuperAdmin) {
    return (
      <div className="card-ui p-10 text-center">
        <FiTrash2 className="mx-auto mb-3 text-4xl text-slate-200" />
        <p className="text-sm text-slate-500">The recycle bin is available to super admins only.</p>
      </div>
    );
  }

  const switchModel = (key) => {
    setModel(key);
    setPage(1);
  };

  const columns = [
    {
      key: 'item',
      label: 'Item',
      render: (item) => (
        <div className="min-w-[220px]">
          <div className="font-semibold text-slate-800">{item.title}</div>
          {item.subtitle && <div className="mt-0.5 text-xs text-slate-400">{item.subtitle}</div>}
        </div>
      )
    },
    {
      key: 'model',
      label: 'Model',
      render: (item) => (
        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {item.modelLabel}
        </span>
      )
    },
    {
      key: 'deletedAt',
      label: 'Deleted',
      render: (item) => <span className="whitespace-nowrap text-slate-600">{fmtDateTime(item.deletedAt)}</span>
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (item) => (
        <button
          type="button"
          onClick={() => confirmRestore(item)}
          disabled={restoreMut.isLoading}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          <FiRotateCcw size={13} /> Restore
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recycle Bin"
        subtitle={`${totalDeleted} deleted item${totalDeleted !== 1 ? 's' : ''} across ${models.filter((m) => m.count > 0).length} model${models.filter((m) => m.count > 0).length !== 1 ? 's' : ''} · restore brings a record back, hidden items stay hidden until re-enabled`}
        icon={FiTrash2}
      />

      {/* Model filter chips — the primary way to browse the bin */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => switchModel('all')}
          className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
            model === 'all'
              ? 'border-transparent bg-[var(--brand)] text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
          }`}
        >
          All ({totalDeleted})
        </button>
        {models
          .filter((m) => m.count > 0)
          .map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => switchModel(m.key)}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                model === m.key
                  ? 'border-transparent bg-[var(--brand)] text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
              }`}
            >
              {m.label} ({m.count})
            </button>
          ))}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        onSubmit={() => setPage(1)}
        searchPlaceholder="Search deleted items by name, code, number…"
        onReset={() => {
          setSearch('');
          setModel('all');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={items}
        selectionLabel="items"
        exportFileName="recycle-bin-selection.csv"
        bulkActions={[
          {
            label: 'Restore',
            icon: FiRotateCcw,
            tone: 'success',
            action: 'Restored',
            unit: 'items',
            confirm: (rows) =>
              confirmAction({
                tone: 'success',
                title: `Restore ${rows.length} item${rows.length === 1 ? '' : 's'}?`,
                text: 'Anything that was hidden before it was deleted stays hidden after the restore.',
                items: rows.map((item) => `${item.title} · ${item.modelLabel}`),
                confirmText: 'Restore'
              }),
            perform: (item) => api.restoreTrashItem({ model: item.model, id: item.id }),
            rowLabel: (item) => item.title,
            onSettled: refreshTrash
          }
        ]}
        isLoading={isLoading || isFetching}
        empty={<EmptyState title="Nothing in the bin" icon={FiTrash2} />}
        footer={<Pagination page={page} totalPages={totalPages} onPage={setPage} total={total} unit="items" />}
      />
    </div>
  );
}
