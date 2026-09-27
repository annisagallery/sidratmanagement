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
import { promptText, confirmAction, toastSuccess, alertError } from 'src/utils/swal';
import { FiCheckSquare, FiEdit2, FiPlay, FiPrinter, FiTag, FiXCircle } from 'react-icons/fi';
import ActionMenu from 'src/components/_admin/ui/ActionMenu';
import { EmptyState, ErrorState } from 'src/components/_admin/ui/TableStates';
import { LuFactory } from 'react-icons/lu';

import {
  cancelProductionBatch,
  closeProductionBatch,
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
  oid,
  qty,
  LoadingRows,
  ErrorRow
} from 'src/components/_admin/ui/primitives';
import {
  BatchStatusPill,
  MATERIAL_STATUS,
  UnitStatusPill,
  catalogCode,
  variationLabel
} from 'src/components/_admin/inventory/shared';
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
      alertError(error, { title: 'The sticker sheet could not be built' });
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

  const close = useMutation(closeProductionBatch, {
    onSuccess: (response) => {
      const { voidedUnits = 0, requeuedItems = 0 } = response?.data || {};
      toastSuccess(
        'Batch closed',
        `${voidedUnits} unmade piece${voidedUnits === 1 ? '' : 's'} voided${
          requeuedItems ? `, ${requeuedItems} order${requeuedItems === 1 ? '' : 's'} back in the queue` : ''
        }`
      );
      refresh();
      unitsQuery.refetch();
    },
    onError: (error) => alertError(error, { title: 'The batch could not be closed' })
  });

  if (batchQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-ui h-[104px] animate-pulse" />
          ))}
        </div>
        <div className="card-ui h-72 animate-pulse" />
      </div>
    );
  }

  if (batchQuery.isError) {
    return <ErrorState error={batchQuery.error} title="This batch could not be loaded" onRetry={batchQuery.refetch} />;
  }

  if (!batch) {
    return (
      <div className="card-ui">
        <EmptyState
          icon={LuFactory}
          title={`Batch ${batchNo} was not found`}
          hint="It may have been renumbered, or the link is wrong."
          action={
            <button type="button" onClick={() => router.push('/production')} className="btn-ghost">
              Back to batches
            </button>
          }
        />
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

  // Once something has been received a batch cannot be cancelled; it is closed
  // short instead, and the reason is kept on the batch.
  const confirmClose = async () => {
    const left = totalPlanned - totalMade;
    const reason = await promptText({
      tone: 'danger',
      title: `Close ${batch.batchNo} early?`,
      text: `${totalMade} of ${totalPlanned} pieces were received. The ${left} not made will be voided, and any customer waiting on one goes back to the production queue.`.replace(/<[^>]*>/g, ''),
      label: 'Why is it closing early?',
      placeholder: 'e.g. fabric ran out',
      requiredMessage: 'A reason is required.',
      multiline: false,
      confirmText: 'Close batch'
    });
    if (reason) close.mutate({ id: batchId, note: reason });
  };

  const confirmCancel = async () => {
    const confirmed = await confirmAction({
      tone: 'danger',
      glyph: 'danger',
      title: `Cancel ${batch.batchNo}?`,
      text: 'Every line is withdrawn and any piece still on the floor is voided. Order items go back to the queue.',
      confirmText: 'Cancel batch',
      cancelText: 'Keep batch'
    });
    if (confirmed) cancel.mutate({ id: batchId });
  };

  return (
    <div className="space-y-6">
      <PageBar
        eyebrow="Production batch"
        title={batch.batchNo}
        subtitle={`Version ${batch.version || 1} · received into ${batch.destinationBranch?.name || 'HQ'}`}
        back={() => router.push('/production')}
      >
        <button type="button" onClick={() => setEditing(true)} className="btn-ghost">
          <FiEdit2 size={14} aria-hidden /> Edit
        </button>
        {batch.status === 'DRAFT' ? (
          <button type="button" onClick={() => start.mutate(batchId)} disabled={start.isLoading} className="btn-brand">
            <FiPlay size={14} aria-hidden /> {start.isLoading ? 'Starting…' : 'Start production'}
          </button>
        ) : (
          <button
            type="button"
            onClick={printStickers}
            disabled={building}
            title="Opens a print-ready PDF with one barcode label per piece"
            className="btn-ghost"
          >
            <FiPrinter size={14} aria-hidden /> {building ? 'Building PDF…' : 'Stickers'}
          </button>
        )}
        {['DRAFT', 'IN_PRODUCTION'].includes(batch.status) ? (
          <ActionMenu
            label={`More actions for ${batch.batchNo}`}
            items={[
              batch.status === 'IN_PRODUCTION' && totalMade > 0
                ? { label: 'Close early…', icon: FiCheckSquare, onClick: confirmClose, disabled: close.isLoading }
                : { label: 'Cancel batch…', icon: FiXCircle, tone: 'danger', onClick: confirmCancel }
            ]}
          />
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
          <Section title="Lines" icon={LuFactory} hint={`${items.length} product${items.length === 1 ? '' : 's'}`}>
            <GlobalTable>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>For</th>
                  <th>Production codes</th>
                  <th className="text-right">Planned</th>
                  <th className="text-right">Received</th>
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
                            <span className="ops-code ml-2 text-xs font-normal text-slate-500">
                              {catalogCode(item.product, item.variation) || '—'}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">{variationLabel(item.variation)}</p>
                          {item.note ? <p className="mt-1 text-xs text-amber-700">{item.note}</p> : null}
                        </td>
                        <td>
                          {item.orderItem?.orderNo ? (
                            <div className="space-y-1">
                              <Link
                                href={`/orders/${item.orderItem.orderNo}`}
                                className="ops-code text-[12px] font-semibold text-slate-900 hover:underline"
                              >
                                #{item.orderItem.orderNo}
                              </Link>
                              {MATERIAL_STATUS[item.orderItem.materialStatus] ? (
                                <Pill tone={MATERIAL_STATUS[item.orderItem.materialStatus].tone}>
                                  {MATERIAL_STATUS[item.orderItem.materialStatus].label}
                                </Pill>
                              ) : null}
                            </div>
                          ) : (
                            <Pill tone="neutral">Stock</Pill>
                          )}
                        </td>
                        <td>
                          {unitsQuery.isLoading ? (
                            <span className="text-xs text-slate-500">Loading…</span>
                          ) : codes.length ? (
                            <div className="flex max-w-xs flex-wrap items-center gap-1">
                              {codes.slice(0, 6).map((code) => (
                                <span key={code} className="inline-flex items-center">
                                  <Code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{code}</Code>
                                </span>
                              ))}
                              {codes.length > 6 ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                                  +{codes.length - 6}
                                </span>
                              ) : null}
                              <CopyButton value={codes.join('\n')} label="Copy every unit code on this line" />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">
                              {batch.status === 'DRAFT' ? 'Issued when started' : 'None'}
                            </span>
                          )}
                        </td>
                        <td className="text-right tabular-nums font-semibold text-slate-700">{item.quantity}</td>
                        <td className="text-right tabular-nums font-semibold text-emerald-700">
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

          {batch.status !== 'DRAFT' ? (
            <Section title="Pieces" icon={FiTag} hint={`${(unitsQuery.data?.data || []).length} barcodes`}>
              <GlobalTable>
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Made by</th>
                    <th>For</th>
                  </tr>
                </thead>
                <tbody>
                  {unitsQuery.isLoading ? (
              <LoadingRows colSpan={5} />
            ) : unitsQuery.isError ? (
              <ErrorRow colSpan={5} error={unitsQuery.error} onRetry={unitsQuery.refetch} />
            ) : (unitsQuery.data?.data || []).length ? (
                    (unitsQuery.data?.data || []).map((unit) => (
                      <tr key={oid(unit)}>
                        <td>
                          <Code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{unit.barcode}</Code>
                        </td>
                        <td className="text-[12px] text-slate-700">
                          {unit.product?.name}
                          <span className="block text-xs text-slate-500">{variationLabel(unit.variation)}</span>
                        </td>
                        <td>
                          <UnitStatusPill status={unit.status} />
                          {unit.reversalNote ? (
                            <span className="mt-0.5 block text-xs text-slate-500">{unit.reversalNote}</span>
                          ) : null}
                        </td>
                        <td className="text-[12px] text-slate-600">
                          {unit.producedBy?.name || '—'}
                          {unit.submittedAt ? (
                            <span className="block text-xs text-slate-500">
                              {format(new Date(unit.submittedAt), 'dd MMM, hh:mm a')}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {unit.orderItem?.orderNo ? (
                            <Link
                              href={`/orders/${unit.orderItem.orderNo}`}
                              className="ops-code text-[12px] font-semibold text-slate-900 hover:underline"
                            >
                              #{unit.orderItem.orderNo}
                            </Link>
                          ) : (
                            <Pill tone="neutral">Stock</Pill>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyRow colSpan={5} title="No pieces issued" />
                  )}
                </tbody>
              </GlobalTable>
            </Section>
          ) : null}

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
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">{entry.label}</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(entry.at), 'dd MMM yyyy, hh:mm a')} · {entry.by || 'System'}
                      </p>
                    </div>
                  </li>
                ))}
                {!timeline.length ? <li className="text-sm text-slate-500">Nothing has happened yet.</li> : null}
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
