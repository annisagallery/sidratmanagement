'use client';

/**
 * New batch — decide what the floor makes next.
 *
 * Two panes, and the direction of travel is left to right: pick work on the
 * left, watch the batch assemble on the right. Three kinds of work feed the
 * same batch — a customer's order, a shelf that needs refilling, and a line
 * someone adds by hand — and they stay visually distinct in the batch because
 * only one of them carries a promised date.
 *
 * Nothing here decides what is legal: the batch saves as a draft, and starting
 * it (which issues the barcodes) is a separate act on the batch itself.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { differenceInCalendarDays, format, isBefore, startOfDay } from 'date-fns';
import { FiCheck, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import { LuFactory } from 'react-icons/lu';

import {
  createProductionBatch,
  getProductionNeeds,
  getProductionReplenishment,
  searchProducts
} from 'src/services';
import {
  Field,
  PageBar,
  Pill,
  Section,
  SectionBody,
  StatTile,
  errorAlert,
  fieldClass,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { catalogCode, displaySku, needName, variationLabel } from 'src/components/_admin/inventory/shared';

function dueLabel(value) {
  if (!value) return { text: 'no date', tone: 'neutral' };
  const due = new Date(value);
  if (isBefore(due, startOfDay(new Date()))) {
    return { text: `${Math.abs(differenceInCalendarDays(due, startOfDay(new Date())))}d late`, tone: 'bad' };
  }
  return { text: format(due, 'd MMM'), tone: 'neutral' };
}

export default function BatchBuilder() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [picked, setPicked] = useState([]); // order-backed lines
  const [refills, setRefills] = useState([]); // replenishment lines
  const [extras, setExtras] = useState([]); // hand-added stock lines
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState({ product: '', variation: '', quantity: 1, note: '' });

  const needsQuery = useQuery('production-needs', () => getProductionNeeds({ status: 'production-needed' }));
  // Shelf-refill suggestions are optional: where the API does not provide them
  // this pane simply shows customer demand.
  const refillQuery = useQuery('production-replenishment', getProductionReplenishment, { retry: false });
  const productsQuery = useQuery(['batch-products', search], () => searchProducts({ search, limit: 25 }), {
    keepPreviousData: true
  });

  const needs = needsQuery.data?.data || [];
  const replenishment = refillQuery.data?.data || [];
  const products = productsQuery.data?.data || [];
  const chosenProduct = products.find((product) => oid(product) === manual.product);

  const pickedIds = useMemo(() => new Set(picked.map((entry) => entry.id)), [picked]);
  const refillIds = useMemo(() => new Set(refills.map((entry) => entry.variationId)), [refills]);

  const availableNeeds = needs.filter((need) => !pickedIds.has(oid(need)));
  const availableRefills = replenishment.filter((row) => !refillIds.has(row.variationId));
  const totalLines = picked.length + refills.length + extras.length;

  const save = useMutation(
    () =>
      createProductionBatch({
        note,
        items: [
          ...picked.map((entry) => ({ orderItem: entry.id, note: entry.note })),
          ...refills.map((row) => ({
            product: row.productId,
            variation: row.variationId,
            quantity: Number(row.suggestedQuantity),
            note: `Replenishment to ${row.targetStock}`
          })),
          ...extras.map((entry) => ({
            product: entry.product,
            variation: entry.variation || null,
            quantity: Number(entry.quantity),
            note: entry.note
          }))
        ]
      }),
    {
      onSuccess: (response) => {
        toast(`Draft ${response?.data?.batchNo || 'batch'} created`);
        queryClient.invalidateQueries('production-batches');
        queryClient.invalidateQueries('production-needs');
        const batchNo = response?.data?.batchNo;
        router.push(batchNo ? `/production/batches/${batchNo}` : '/production');
      },
      onError: (error) => errorAlert('The batch could not be created', error)
    }
  );

  const addManual = () => {
    if (!manual.product || Number(manual.quantity) < 1) return;
    const product = products.find((entry) => oid(entry) === manual.product);
    const variation = (product?.variations || []).find((entry) => oid(entry) === manual.variation);
    setExtras((current) => [
      ...current,
      {
        ...manual,
        key: `extra-${Date.now()}`,
        productName: product?.name,
        variationName: variation ? variationLabel(variation) : 'Base product'
      }
    ]);
    setManual({ product: '', variation: '', quantity: 1, note: '' });
  };

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Production"
        title="New batch"
        subtitle="Saved as a draft. Starting it is what issues the barcodes."
        back={() => router.push('/production')}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="For customers" value={qty(picked.length)} note="Order-backed lines" tone={picked.length ? 'info' : 'muted'} />
        <StatTile label="For stock" value={qty(refills.length + extras.length)} note="Shelf refill and manual" tone={refills.length + extras.length ? 'good' : 'muted'} />
        <StatTile label="Lines on this batch" value={qty(totalLines)} note={totalLines ? 'Ready to save' : 'Nothing picked yet'} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── pick work ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Section
            title="Waiting for production"
            icon={LuFactory}
            hint={`${availableNeeds.length} customer${availableNeeds.length === 1 ? '' : 's'} waiting`}
          >
            <SectionBody className="max-h-[420px] overflow-y-auto p-0">
              <ul className="divide-y divide-slate-100">
                {availableNeeds.map((need) => {
                  const due = dueLabel(need.deliveryDate);
                  return (
                    <li key={oid(need)} className="px-4 py-2.5 transition hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="ops-code w-20 shrink-0 text-[11px] text-slate-500">#{need.orderNo}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-slate-800">{needName(need)}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {catalogCode(need.product, need.variation) ? (
                              <span className="ops-code mr-1.5 text-slate-400">
                                {catalogCode(need.product, need.variation)}
                              </span>
                            ) : null}
                            {variationLabel(need.variation)}
                          </p>
                        </div>
                        {need.isCustom ? <Pill tone="info">Custom</Pill> : null}
                        <Pill tone={due.tone}>{due.text}</Pill>
                        <button
                          type="button"
                          onClick={() =>
                            setPicked((current) => [
                              ...current,
                              {
                                id: oid(need),
                                orderNo: need.orderNo,
                                name: needName(need),
                                code: catalogCode(need.product, need.variation),
                                variation: variationLabel(need.variation),
                                due: need.deliveryDate,
                                note: need.customizeDetails || ''
                              }
                            ])
                          }
                          className="btn-brand h-8 !text-xs"
                        >
                          <FiPlus size={12} /> Add
                        </button>
                      </div>
                      {need.customizeDetails ? (
                        <p className="mt-1 line-clamp-2 rounded border-l-2 border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                          {need.customizeDetails}
                        </p>
                      ) : null}
                    </li>
                  );
                })}

                {availableRefills.map((row) => (
                  <li key={row.variationId} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50">
                    <span className="ops-code w-20 shrink-0 truncate text-[11px] text-slate-500">
                      {catalogCode({ code: row.productCode }, { productionCode: row.productionCode }) ||
                        displaySku(row.sku) ||
                        '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-800">{row.productName}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        <span className={row.freeStock <= 0 ? 'font-semibold text-rose-600' : ''}>
                          {row.freeStock} free
                        </span>{' '}
                        · min {row.minStock}
                        {row.inProduction ? ` · ${row.inProduction} being made` : ''}
                      </p>
                    </div>
                    <Pill tone="good">Stock</Pill>
                    <span className="w-20 shrink-0 text-right text-[11px] font-semibold text-slate-500">
                      make {row.suggestedQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRefills((current) => [...current, row])}
                      className="btn-brand h-8 !text-xs"
                    >
                      <FiPlus size={12} /> Add
                    </button>
                  </li>
                ))}

                {!availableNeeds.length && !availableRefills.length ? (
                  <li className="px-6 py-12 text-center">
                    <FiCheck className="mx-auto mb-2 text-2xl text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">Nothing waiting</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Add stock lines below to make pieces nobody has ordered yet.
                    </p>
                  </li>
                ) : null}
              </ul>
            </SectionBody>
          </Section>

          <Section
            title="Make for stock"
            icon={FiPlus}
            hint="Pieces nobody has ordered yet"
            actions={
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products…"
                  className="input-ui w-52 pl-8"
                  aria-label="Search products"
                />
              </div>
            }
          >
            <SectionBody className="grid gap-2 p-4 md:grid-cols-[1fr_1fr_90px_auto]">
              <select
                className={fieldClass}
                value={manual.product}
                onChange={(event) => setManual({ ...manual, product: event.target.value, variation: '' })}
                aria-label="Product"
              >
                <option value="">Choose product…</option>
                {products.map((product) => (
                  <option key={oid(product)} value={oid(product)}>
                    {product.name} · #{product.code}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
                value={manual.variation}
                onChange={(event) => setManual({ ...manual, variation: event.target.value })}
                disabled={!chosenProduct?.variations?.length}
                aria-label="Variation"
              >
                <option value="">{chosenProduct?.variations?.length ? 'Choose variation…' : 'Base product'}</option>
                {(chosenProduct?.variations || []).map((variation) => (
                  <option key={oid(variation)} value={oid(variation)}>
                    {variationLabel(variation)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                className={fieldClass}
                value={manual.quantity}
                onChange={(event) => setManual({ ...manual, quantity: Number(event.target.value) })}
                aria-label="Quantity"
              />
              <button type="button" onClick={addManual} disabled={!manual.product} className="btn-ghost h-[38px]">
                <FiPlus size={14} /> Add
              </button>
              <input
                className={`${fieldClass} md:col-span-4`}
                value={manual.note}
                onChange={(event) => setManual({ ...manual, note: event.target.value })}
                placeholder="Production note for this line (optional)"
                aria-label="Production note"
              />
            </SectionBody>
          </Section>
        </div>

        {/* ── the batch ─────────────────────────────────────────────────── */}
        <aside className="space-y-4 xl:sticky xl:top-0">
          <Section title="This batch" icon={LuFactory} hint={`${totalLines} line${totalLines === 1 ? '' : 's'}`}>
            <SectionBody className="max-h-[420px] overflow-y-auto p-0">
              <ul className="divide-y divide-slate-100">
                {picked.map((entry) => (
                  <li key={entry.id} className="bg-sky-50/50 p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-slate-900">{entry.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          Order #{entry.orderNo} · {entry.code ? `${entry.code} · ` : ''}
                          {entry.variation}
                        </p>
                      </div>
                      <Pill tone={dueLabel(entry.due).tone}>{dueLabel(entry.due).text}</Pill>
                      <button
                        type="button"
                        aria-label={`Remove ${entry.name}`}
                        onClick={() => setPicked((current) => current.filter((item) => item.id !== entry.id))}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-white hover:text-rose-600"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={entry.note}
                      onChange={(event) =>
                        setPicked((current) =>
                          current.map((item) => (item.id === entry.id ? { ...item, note: event.target.value } : item))
                        )
                      }
                      placeholder="Production note"
                      className="mt-2 w-full resize-none rounded-md border border-sky-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-[var(--brand)]"
                    />
                  </li>
                ))}

                {refills.map((row) => (
                  <li key={row.variationId} className="flex items-center gap-2 bg-emerald-50/50 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-slate-900">{row.productName}</p>
                      <p className="truncate text-[11px] text-emerald-700">Refill shelf to {row.targetStock}</p>
                    </div>
                    <span className="ops-code text-[13px] font-black text-slate-900">{row.suggestedQuantity}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${row.productName}`}
                      onClick={() => setRefills((current) => current.filter((item) => item.variationId !== row.variationId))}
                      className="rounded-md p-1 text-slate-400 transition hover:bg-white hover:text-rose-600"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </li>
                ))}

                {extras.map((entry) => (
                  <li key={entry.key} className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-slate-900">{entry.productName}</p>
                        <p className="truncate text-[11px] text-slate-500">For stock · {entry.variationName}</p>
                      </div>
                      <span className="ops-code text-[13px] font-black text-slate-900">{entry.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${entry.productName}`}
                        onClick={() => setExtras((current) => current.filter((item) => item.key !== entry.key))}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                    {entry.note ? <p className="mt-1 text-[11px] text-slate-500">{entry.note}</p> : null}
                  </li>
                ))}

                {!totalLines ? (
                  <li className="px-6 py-12 text-center text-sm text-slate-400">
                    Nothing picked yet. Add work from the left.
                  </li>
                ) : null}
              </ul>
            </SectionBody>
          </Section>

          <Section title="Batch note" icon={FiPlus}>
            <SectionBody>
              <Field label="Internal to production" hint="Instructions, deadline, fabric allocation.">
                <textarea
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className={`${fieldClass} resize-none`}
                  placeholder="Anything the floor needs to know about this run"
                />
              </Field>
            </SectionBody>
          </Section>

          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isLoading || !totalLines}
            className="btn-brand h-11 w-full"
          >
            {save.isLoading ? 'Saving…' : `Save draft batch (${totalLines})`}
          </button>
        </aside>
      </div>
    </div>
  );
}
