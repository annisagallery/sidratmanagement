'use client';

/**
 * One production batch, on its own page.
 *
 * This used to be a modal, which meant a batch with thirty pieces and a long
 * revision history was read through a letterbox. As a page it can show the
 * planned lines, the barcode of every physical piece, and the full timeline at
 * the same time — and it can be linked to, which is how a batch number gets
 * passed between the office and the floor.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { FiEdit2, FiPlay, FiPrinter, FiXCircle } from 'react-icons/fi';
import { LuFactory } from 'react-icons/lu';

import {
  cancelProductionBatch,
  getProductionBatchUnits,
  getProductionBatches,
  startProductionBatch
} from 'src/services';
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { Code } from 'src/components/_admin/ops/primitives';
import {
  CopyButton,
  EmptyRow,
  PageBar,
  Pill,
  Row,
  Section,
  SectionBody,
  StatTile,
  errorAlert,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { BatchStatusPill, catalogCode, variationLabel } from 'src/components/_admin/inventory/shared';
import { openLabelSheet, productionStickerLabels } from 'src/components/_admin/labels/openLabelSheet';
import BatchEditModal from './BatchEditModal';

export default function BatchDetail({ batchNo }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  // There is no fetch-one endpoint; the list filters `batchNo` by regex, so the
  // exact match is picked out of the page it returns.
  const batchQuery = useQuery(['production-batch', batchNo], () => getProductionBatches({ search: batchNo, limit: 20 }), {
    enabled: Boolean(batchNo)
  });
  const batch = (batchQuery.data?.data || []).find((entry) => entry.batchNo === batchNo) || null;
  const batchId = oid(batch);

  const unitsQuery = useQuery(['production-batch-units', batchId], () => getProductionBatchUnits(batchId), {
    enabled: Boolean(batchId) && batch?.status !== 'DRAFT'
  });

  // Keyed on `productionBatchItemId` — the column the API actually returns. It
  // was keyed on `productionBatchItem`, a Mongoose-era name that no longer
  // exists, so every unit landed under "undefined" and the codes column on
  // every line came back empty.
  const unitsByItem = useMemo(() => {
    const map = new Map();
    (unitsQuery.data?.data || []).forEach((unit) => {
      const key = String(unit.productionBatchItemId);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(unit);
    });
    return map;
  }, [unitsQuery.data]);

  // Straight to a PDF rather than through a rendered page: the sheet is die-cut
  // stock, and a browser print dialog is free to scale it.
  const [building, setBuilding] = useState(false);
  const printStickers = async () => {
    setBuilding(true);
    try {
      const units = unitsQuery.data?.data || (await getProductionBatchUnits(batchId))?.data || [];
      await openLabelSheet(productionStickerLabels(units), {
        title: `${batch?.batchNo || 'Batch'} stickers`
      });
    } catch (error) {
      errorAlert('The sticker sheet could not be built', error);
    } finally {
      setBuilding(false);
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries('production-batch');
    queryClient.invalidateQueries('production-batches');
    queryClient.invalidateQueries('production-needs');
    batchQuery.refetch();
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

  if (batchQuery.isLoading) return <div className="h-64 animate-pulse rounded-md bg-slate-100" />;

  if (!batch) {
    return (
      <div className="card-ui p-16 text-center">
        <p className="text-sm font-semibold text-rose-600">Batch {batchNo} was not found.</p>
        <button type="button" onClick={() => router.push('/production')} className="btn-ghost mt-4">
          Back to batches
        </button>
      </div>
    );
  }

  const items = batch.items || [];
  const totalPlanned = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalMade = items.reduce((sum, item) => sum + Number(item.completedQuantity || 0), 0);
  const forOrders = items.filter((item) => item.orderItem).length;

  const timeline = [
    { label: 'Batch planned', at: batch.createdAt, by: batch.createdBy?.name },
    ...(batch.revisions || []).map((revision) => ({
      label: `Edited to version ${revision.version + 1}`,
      at: revision.editedAt,
      by: revision.editedBy?.name
    })),
    { label: 'Sent to the floor', at: batch.startedAt, by: batch.startedBy?.name },
    ...items.flatMap((item) =>
      (item.submissions || []).map((submission) => ({
        label: `${submission.quantity} × ${item.product?.name || 'piece'} received`,
        at: submission.submittedAt,
        by: submission.submittedBy?.name
      }))
    ),
    { label: 'Batch completed', at: batch.completedAt, by: batch.completedBy?.name }
  ]
    .filter((entry) => entry.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  const confirmCancel = async () => {
    const result = await Swal.fire({
      title: `Cancel ${batch.batchNo}?`,
      text: 'Every line is withdrawn and any piece still on the floor is voided. Order items go back to the queue.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel batch',
      confirmButtonColor: '#e11d48'
    });
    if (result.isConfirmed) cancel.mutate({ id: batchId });
  };

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Production batch"
        title={batch.batchNo}
        subtitle={`Version ${batch.version || 1} · received into ${batch.destinationBranch?.name || 'HQ'}`}
        back={() => router.push('/production')}
      >
        <button type="button" onClick={() => setEditing(true)} className="btn-ghost">
          <FiEdit2 size={14} /> Edit
        </button>
        {batch.status === 'DRAFT' ? (
          <button type="button" onClick={() => start.mutate(batchId)} disabled={start.isLoading} className="btn-brand">
            <FiPlay size={14} /> {start.isLoading ? 'Starting…' : 'Start production'}
          </button>
        ) : (
          <button
            type="button"
            onClick={printStickers}
            disabled={building}
            title="Opens a print-ready PDF with one barcode label per piece"
            className="btn-ghost"
          >
            <FiPrinter size={14} /> {building ? 'Building PDF…' : 'Stickers'}
          </button>
        )}
        {['DRAFT', 'IN_PRODUCTION'].includes(batch.status) ? (
          <button
            type="button"
            onClick={confirmCancel}
            className="btn-ghost !border-rose-200 !text-rose-600 hover:!bg-rose-50"
          >
            <FiXCircle size={14} /> Cancel
          </button>
        ) : null}
      </PageBar>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Status" value={<BatchStatusPill status={batch.status} />} note={`${items.length} lines`} />
        <StatTile label="Planned" value={qty(totalPlanned)} note="Pieces to make" />
        <StatTile
          label="Received"
          value={qty(totalMade)}
          note={totalPlanned ? `${Math.round((totalMade / totalPlanned) * 100)}% complete` : ''}
          tone={totalMade >= totalPlanned && totalPlanned > 0 ? 'good' : 'warn'}
        />
        <StatTile
          label="For customers"
          value={qty(forOrders)}
          note={`${items.length - forOrders} for stock`}
          tone={forOrders ? 'info' : 'muted'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Lines" icon={LuFactory} hint={`${items.length} products`}>
            <GlobalTable>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>For</th>
                  <th>Production codes</th>
                  <th className="text-center">Planned</th>
                  <th className="text-center">Received</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((item) => {
                    const units = unitsByItem.get(String(oid(item))) || [];
                    const submitted = (item.submissions || []).flatMap((entry) => entry.unitBarcodes || []);
                    const codes = units.length ? units.map((unit) => unit.barcode) : submitted;
                    return (
                      <tr key={oid(item)} className="align-top">
                        <td>
                          <p className="text-[13px] font-semibold text-slate-800">
                            {item.product?.name}
                            <span className="ops-code ml-2 text-[11px] font-normal text-slate-400">
                              {catalogCode(item.product, item.variation) || '—'}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500">{variationLabel(item.variation)}</p>
                          {item.note ? <p className="mt-1 text-[11px] text-amber-700">{item.note}</p> : null}
                        </td>
                        <td>
                          {item.orderItem?.orderNo ? (
                            <Link
                              href={`/orders/${item.orderItem.orderNo}`}
                              className="ops-code text-[12px] text-[var(--brand-strong)] hover:underline"
                            >
                              #{item.orderItem.orderNo}
                            </Link>
                          ) : (
                            <Pill tone="neutral">Stock</Pill>
                          )}
                        </td>
                        <td>
                          {unitsQuery.isLoading ? (
                            <span className="text-[11px] text-slate-400">Loading…</span>
                          ) : codes.length ? (
                            <div className="flex max-w-xs flex-wrap items-center gap-1">
                              {codes.slice(0, 6).map((code) => (
                                <span key={code} className="inline-flex items-center">
                                  <Code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{code}</Code>
                                </span>
                              ))}
                              {codes.length > 6 ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                  +{codes.length - 6}
                                </span>
                              ) : null}
                              <CopyButton value={codes.join('\n')} label="Copy every unit code on this line" />
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {batch.status === 'DRAFT' ? 'Issued when started' : 'None'}
                            </span>
                          )}
                        </td>
                        <td className="text-center tabular-nums font-semibold text-slate-700">{item.quantity}</td>
                        <td className="text-center tabular-nums font-bold text-emerald-700">
                          {item.completedQuantity || 0}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <EmptyRow colSpan={5} title="This batch has no lines" />
                )}
              </tbody>
            </GlobalTable>
          </Section>

          {batch.note ? (
            <Section title="Batch note" icon={FiEdit2}>
              <SectionBody>
                <p className="whitespace-pre-wrap text-[13px] text-slate-700">{batch.note}</p>
              </SectionBody>
            </Section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Section title="Details" icon={FiEdit2}>
            <SectionBody>
              <dl>
                <Row label="Batch no" value={batch.batchNo} mono />
                <Row label="Version" value={`v${batch.version || 1}`} />
                <Row label="Planned by" value={batch.createdBy?.name} />
                <Row label="Started by" value={batch.startedBy?.name} />
                <Row label="Completed by" value={batch.completedBy?.name} />
                <Row label="Lands at" value={batch.destinationBranch?.name || 'HQ'} />
              </dl>
            </SectionBody>
          </Section>

          <Section title="Timeline" icon={FiPlay} hint={`${timeline.length} events`}>
            <SectionBody>
              <ol className="relative space-y-4">
                {timeline.map((entry, index) => (
                  <li key={`${entry.label}-${entry.at}-${index}`} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)]" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">{entry.label}</p>
                      <p className="text-[11px] text-slate-400">
                        {format(new Date(entry.at), 'dd MMM yyyy, hh:mm a')} · {entry.by || 'System'}
                      </p>
                    </div>
                  </li>
                ))}
                {!timeline.length ? <li className="text-sm text-slate-400">Nothing has happened yet.</li> : null}
              </ol>
            </SectionBody>
          </Section>
        </aside>
      </div>

      {editing ? (
        <BatchEditModal
          batch={batch}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
