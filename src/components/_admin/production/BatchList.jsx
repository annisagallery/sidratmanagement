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
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { FiPlay, FiPlus, FiPrinter, FiRefreshCw, FiSearch, FiXCircle } from 'react-icons/fi';
import { LuFactory } from 'react-icons/lu';

import { cancelProductionBatch, getProductionBatches, startProductionBatch } from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import Pagination from 'src/components/_admin/ui/Pagination';
import {
  EmptyRow,
  PageBar,
  Section,
  StatTile,
  Toolbar,
  errorAlert,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { BATCH_STATUS, BatchStatusPill } from 'src/components/_admin/inventory/shared';

const planned = (batch) => (batch.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
const made = (batch) => (batch.items || []).reduce((sum, item) => sum + Number(item.completedQuantity || 0), 0);

export default function BatchList() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
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
      toast('Batch started — barcodes are now generated');
      refresh();
    },
    onError: (error) => errorAlert('The batch could not be started', error)
  });

  const cancel = useMutation(cancelProductionBatch, {
    onSuccess: () => {
      toast('Batch cancelled');
      refresh();
    },
    onError: (error) => errorAlert('The batch could not be cancelled', error)
  });

  const confirmCancel = async (batch) => {
    const result = await Swal.fire({
      title: `Cancel ${batch.batchNo}?`,
      text: 'Every line is withdrawn and any piece still on the floor is voided. Order items go back to the queue.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel batch',
      confirmButtonColor: '#e11d48'
    });
    if (result.isConfirmed) cancel.mutate({ id: oid(batch) });
  };

  const counts = batches.reduce((acc, batch) => ({ ...acc, [batch.status]: (acc[batch.status] || 0) + 1 }), {});
  const filterBy = (value) => {
    setStatus((current) => (current === value ? '' : value));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageBar eyebrow="Production" title="Batches" subtitle="Every production run, newest first.">
        <button type="button" onClick={refresh} className="btn-ghost">
          <FiRefreshCw size={14} className={batchesQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
        <Link href="/production/create" className="btn-brand">
          <FiPlus size={15} /> New batch
        </Link>
      </PageBar>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Drafts"
          value={qty(counts.DRAFT || 0)}
          note="Planned, not started"
          onClick={() => filterBy('DRAFT')}
          active={status === 'DRAFT'}
        />
        <StatTile
          label="On the floor"
          value={qty(counts.IN_PRODUCTION || 0)}
          note="Barcodes issued, being made"
          tone="warn"
          onClick={() => filterBy('IN_PRODUCTION')}
          active={status === 'IN_PRODUCTION'}
        />
        <StatTile
          label="Completed"
          value={qty(counts.COMPLETED || 0)}
          note="Every piece received"
          tone="good"
          onClick={() => filterBy('COMPLETED')}
          active={status === 'COMPLETED'}
        />
        <StatTile
          label="Cancelled"
          value={qty(counts.CANCELLED || 0)}
          note="Withdrawn"
          tone="muted"
          onClick={() => filterBy('CANCELLED')}
          active={status === 'CANCELLED'}
        />
      </div>

      <Section
        title="Batch register"
        icon={LuFactory}
        hint={`${batchesQuery.data?.total || 0} total`}
        actions={
          <Toolbar>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search batch no…"
                className="input-ui w-48 pl-8"
                aria-label="Search batches"
              />
            </div>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="select-ui"
              aria-label="Filter by status"
            >
              <option value="">Every status</option>
              {Object.entries(BATCH_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </Toolbar>
        }
      >
        <GlobalTable>
          <thead>
            <tr>
              <th>Batch</th>
              <th className="text-center">Lines</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batchesQuery.isLoading ? (
              <EmptyRow colSpan={6} title="Loading batches…" />
            ) : batches.length ? (
              batches.map((batch) => {
                const total = planned(batch);
                const done = made(batch);
                const percent = total ? Math.round((done / total) * 100) : 0;
                return (
                  <tr key={oid(batch)}>
                    <td>
                      <Link href={`/production/batches/${batch.batchNo}`} className="block">
                        <span className="ops-code text-[13px] font-bold text-[var(--brand-strong)] hover:underline">
                          {batch.batchNo}
                        </span>
                        <span className="block text-[11px] text-slate-400">v{batch.version || 1}</span>
                      </Link>
                    </td>
                    <td className="text-center tabular-nums text-slate-600">{(batch.items || []).length}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                          <span
                            className="block h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <span className="ops-code text-[12px] font-bold text-slate-700">
                          {done}/{total}
                        </span>
                      </div>
                    </td>
                    <td>
                      <BatchStatusPill status={batch.status} />
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-slate-500">
                      {batch.createdAt ? format(new Date(batch.createdAt), 'dd MMM yyyy') : '—'}
                      <span className="block text-slate-400">{batch.createdBy?.name}</span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {batch.status === 'DRAFT' ? (
                          <button
                            type="button"
                            onClick={() => start.mutate(oid(batch))}
                            disabled={start.isLoading}
                            className="btn-brand h-8 !text-xs"
                          >
                            <FiPlay size={12} /> Start
                          </button>
                        ) : null}
                        {batch.status !== 'DRAFT' ? (
                          <button
                            type="button"
                            onClick={() => window.open(`/production-stickers/${oid(batch)}`, '_blank')}
                            title="Print a barcode label for every piece in this batch"
                            className="btn-ghost h-8 !px-2.5 !text-xs"
                          >
                            <FiPrinter size={12} /> Stickers
                          </button>
                        ) : null}
                        {['DRAFT', 'IN_PRODUCTION'].includes(batch.status) ? (
                          <button
                            type="button"
                            onClick={() => confirmCancel(batch)}
                            title="Withdraw this batch and return its orders to the queue"
                            aria-label={`Cancel ${batch.batchNo}`}
                            className="btn-ghost h-8 !px-2 !text-xs !border-rose-200 !text-rose-600 hover:!bg-rose-50"
                          >
                            <FiXCircle size={13} />
                          </button>
                        ) : null}
                        <Link href={`/production/batches/${batch.batchNo}`} className="btn-ghost h-8 !px-2.5 !text-xs">
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow
                colSpan={6}
                icon={LuFactory}
                title="No batches"
                hint="Plan one from the queue to start making pieces."
              />
            )}
          </tbody>
        </GlobalTable>
      </Section>

      <Pagination
        page={page}
        totalPages={batchesQuery.data?.count || 1}
        onPage={setPage}
        total={batchesQuery.data?.total || 0}
        unit="batches"
        pageSize={limit}
      />
    </div>
  );
}
