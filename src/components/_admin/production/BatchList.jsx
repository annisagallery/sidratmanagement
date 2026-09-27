'use client';

/**
 * Production batches — the register of runs.
 *
 * A batch is a promise to make a set number of pieces, so the list is read for
 * one thing: how far along is each one. The progress column carries that
 * directly (submitted vs planned) instead of leaving it to be inferred from a
 * status word, and each row offers only the act its status allows.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next-nprogress-bar';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import { MdAdd, MdCancel, MdOpenInNew, MdPlayArrow, MdPrint } from 'react-icons/md';
import { LuFactory } from 'react-icons/lu';

import { cancelProductionBatch, getProductionBatchUnits, getProductionBatches, startProductionBatch } from 'src/services';
import { alertError, confirmAction, toastSuccess } from 'src/utils/swal';
import { openLabelSheet, productionStickerLabels } from 'src/components/_admin/labels/openLabelSheet';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import ListToolbar from 'src/components/_admin/ui/ListToolbar';
import DataTable, { stopRow } from 'src/components/_admin/ui/DataTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import Segmented from 'src/components/_admin/ui/Segmented';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { EmptyState } from 'src/components/_admin/ui/TableStates';
import { oid, qty } from 'src/components/_admin/ui/primitives';
import { BatchStatusPill } from 'src/components/_admin/inventory/shared';

const planned = (batch) => (batch.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
const made = (batch) => (batch.items || []).reduce((sum, item) => sum + Number(item.completedQuantity || 0), 0);

const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'DRAFT', label: 'Drafts' },
  { id: 'IN_PRODUCTION', label: 'On the floor' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' }
];

function Progress({ done, total }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} pieces made`}
      >
        <span className={`block h-full rounded-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-slate-900'}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="text-[13px] tabular-nums text-slate-700">
        <span className="font-semibold text-slate-900">{qty(done)}</span> / {qty(total)}
      </span>
    </div>
  );
}

export default function BatchList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const batchesQuery = useQuery(
    ['production-batches', page, status, search],
    () => getProductionBatches({ page, limit, ...(status ? { status } : {}), ...(search ? { search } : {}) }),
    { keepPreviousData: true }
  );
  const batches = batchesQuery.data?.data || [];

  const refresh = () => {
    queryClient.invalidateQueries('production-batches');
    queryClient.invalidateQueries('production-needs');
  };

  const start = useMutation(startProductionBatch, {
    onSuccess: () => {
      toastSuccess('Batch started', 'Barcodes are now generated.');
      refresh();
    },
    onError: (error) => alertError(error, { title: 'The batch could not be started' })
  });

  const cancel = useMutation(cancelProductionBatch, {
    onSuccess: () => {
      toastSuccess('Batch cancelled');
      refresh();
    },
    onError: (error) => alertError(error, { title: 'The batch could not be cancelled' })
  });

  const confirmCancel = async (batch) => {
    const confirmed = await confirmAction({
      tone: 'danger',
      glyph: 'danger',
      title: `Cancel ${batch.batchNo}?`,
      text: 'Every line is withdrawn and any piece still on the floor is voided. Order items go back to the queue.',
      confirmText: 'Cancel batch',
      cancelText: 'Keep batch'
    });
    if (confirmed) cancel.mutate({ id: oid(batch) });
  };

  // Stickers go straight to a PDF rather than through a rendered page: the
  // sheet is die-cut stock, and a browser print dialog is free to scale it.
  const [stickersFor, setStickersFor] = useState(null);
  const printStickers = async (batch) => {
    const id = oid(batch);
    setStickersFor(id);
    try {
      const response = await getProductionBatchUnits(id);
      await openLabelSheet(productionStickerLabels(response?.data || []), {
        title: `${batch.batchNo} stickers`
      });
    } catch (error) {
      alertError(error, { title: 'The sticker sheet could not be built' });
    } finally {
      setStickersFor(null);
    }
  };

  // Counts for every status from the server — counting the rows on this page
  // made every filter but the chosen one read 0.
  const counts = batchesQuery.data?.statusCounts || {};
  const allCount = Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0);
  const filterOptions = STATUS_FILTERS.map((f) => {
    const n = f.id ? counts[f.id] || 0 : allCount;
    return { id: f.id, label: `${f.label} ${qty(n)}` };
  });

  const open = (batch) => router.push(`/production/batches/${batch.batchNo}`);

  const columns = [
    {
      key: 'batchNo',
      label: 'Batch',
      render: (batch) => (
        <div>
          <Link href={`/production/batches/${batch.batchNo}`} onClick={stopRow} className="ops-code text-[13px] font-semibold text-slate-900 hover:underline">
            {batch.batchNo}
          </Link>
          <p className="text-xs text-slate-500">Version {batch.version || 1}</p>
        </div>
      )
    },
    {
      key: 'progress',
      label: 'Made',
      render: (batch) => <Progress done={made(batch)} total={planned(batch)} />
    },
    {
      key: 'status',
      label: 'Status',
      render: (batch) => <BatchStatusPill status={batch.status} />
    },
    {
      key: 'createdAt',
      label: 'Created',
      hideBelow: 'md',
      render: (batch) => (
        <div className="whitespace-nowrap">
          <p className="text-[13px] text-slate-700">{batch.createdAt ? format(new Date(batch.createdAt), 'dd MMM yyyy') : '—'}</p>
          {batch.createdBy?.name && <p className="text-xs text-slate-500">{batch.createdBy.name}</p>}
        </div>
      )
    },
    {
      key: 'actions',
      label: '',
      srLabel: 'Actions',
      align: 'right',
      render: (batch) => {
        const id = oid(batch);
        return (
          <div className="flex items-center justify-end gap-1" onClick={stopRow}>
            {batch.status === 'DRAFT' ? (
              <button type="button" onClick={() => start.mutate(id)} disabled={start.isLoading} className="btn-brand btn-sm">
                <MdPlayArrow size={16} aria-hidden /> Start
              </button>
            ) : (
              <button
                type="button"
                onClick={() => printStickers(batch)}
                disabled={stickersFor === id}
                title="A print-ready PDF with one barcode label per piece"
                className="btn-ghost btn-sm"
              >
                <MdPrint size={16} aria-hidden /> {stickersFor === id ? 'Building…' : 'Stickers'}
              </button>
            )}
            <ActionMenu
              label={`More actions for ${batch.batchNo}`}
              items={[
                { label: 'Open batch', icon: MdOpenInNew, onClick: () => open(batch) },
                {
                  label: 'Cancel batch',
                  icon: MdCancel,
                  tone: 'danger',
                  onClick: () => confirmCancel(batch),
                  hidden: !['DRAFT', 'IN_PRODUCTION'].includes(batch.status)
                }
              ]}
            />
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Batches" subtitle="Every production run, newest first.">
        <Link href="/production/create" className="btn-brand">
          <MdAdd size={18} aria-hidden /> New batch
        </Link>
      </PageHeader>

      <ListToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSubmit={() => {
          setSearch(searchInput.trim());
          setPage(1);
        }}
        searchPlaceholder="Search by batch number…"
        onRefresh={refresh}
        refreshing={batchesQuery.isFetching}
        onReset={
          status || search
            ? () => {
                setStatus('');
                setSearch('');
                setSearchInput('');
                setPage(1);
              }
            : undefined
        }
      >
        <Segmented
          label="Filter by status"
          options={filterOptions}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          className="max-w-full overflow-x-auto"
        />
      </ListToolbar>

      <DataTable
        caption="Production batches"
        columns={columns}
        data={batches}
        rowKey={(batch) => oid(batch)}
        onRowClick={open}
        rowLabel={(batch) => `Open ${batch.batchNo}`}
        selectable={false}
        isLoading={batchesQuery.isLoading}
        isFetching={batchesQuery.isFetching}
        error={batchesQuery.isError ? batchesQuery.error : null}
        onRetry={batchesQuery.refetch}
        empty={
          <EmptyState
            icon={LuFactory}
            title={status || search ? 'No batches match' : 'No batches yet'}
            hint={status || search ? 'Try another status or clear the search.' : 'Plan one from the queue to start making pieces.'}
            action={
              status || search ? null : (
                <Link href="/production/queue" className="btn-ghost">
                  Open the queue
                </Link>
              )
            }
          />
        }
        footer={
          <Pagination
            page={page}
            totalPages={batchesQuery.data?.count || 1}
            onPage={setPage}
            total={batchesQuery.data?.total || 0}
            unit="batches"
            pageSize={limit}
          />
        }
      />
    </div>
  );
}
