'use client';

/**
 * New batch — decide what the floor makes next.
 *
 * The batch is a docket, like a purchase or a transfer: the search bar adds a
 * stock line for anything in the catalogue (a scan of the same product again is
 * one more, not a second line), the table is the batch, the foot is the note
 * and the count.
 *
 * Beside it, narrow and scrolling on its own, is the work waiting — customers
 * earliest promise first, then shelves below their minimum. One press adds a
 * row to the batch, so planning is reading down that list and pressing +.
 *
 * Nothing here decides what is legal: the batch saves as a draft, and starting
 * it — which checks materials and issues barcodes — happens on the batch page.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { differenceInCalendarDays, format, isBefore, startOfDay } from 'date-fns';
import { FiAlertTriangle, FiCheck, FiPlus, FiSave, FiSearch } from 'react-icons/fi';
import { LuFactory } from 'react-icons/lu';

import { createProductionBatch, getProductionNeeds, getProductionReplenishment, searchProducts } from 'src/services';
import {
  CellInput,
  DocketCount,
  DocketEmpty,
  DocketField,
  DocketFoot,
  DocketRow,
  DocketSearch,
  DocketTable
} from 'src/components/_admin/ui/docket';
import {
  Notice,
  PageBar,
  Pill,
  Section,
  errorAlert,
  fieldClass,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { catalogCode, displaySku, needName, variationLabel } from 'src/components/_admin/inventory/shared';

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** How the promised date reads out loud, and whether it is late. */
function dueMeta(value) {
  if (!value) return { text: 'No date', tone: 'neutral', overdue: false };
  const due = new Date(value);
  const today = startOfDay(new Date());
  if (isBefore(due, today)) {
    return { text: `${Math.abs(differenceInCalendarDays(due, today))}d late`, tone: 'bad', overdue: true };
  }
  const days = differenceInCalendarDays(due, today);
  return {
    text: days === 0 ? 'Due today' : format(due, 'd MMM'),
    tone: days <= 3 ? 'warn' : 'neutral',
    overdue: false
  };
}

const KIND = {
  order: { label: 'Customer', tone: 'info' },
  refill: { label: 'Refill', tone: 'good' },
  stock: { label: 'Stock', tone: 'neutral' }
};

const HEAD = [
  { label: 'Product' },
  { label: 'For' },
  { label: 'Production note' },
  { label: 'Pieces', className: 'text-right' }
];

export default function BatchBuilder() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('');
  const [tab, setTab] = useState('orders');
  const [filter, setFilter] = useState('');

  // Search, debounced like the purchase docket so a scanner is not outrun.
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const searchTimer = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const needsQuery = useQuery('production-needs', () =>
    getProductionNeeds({ status: 'production-needed', limit: 500 })
  );
  // Shelf-refill suggestions are optional: where the API does not provide them
  // the tab is simply empty.
  const refillQuery = useQuery('production-replenishment', getProductionReplenishment, { retry: false });
  const productsQuery = useQuery(
    ['batch-products', debounced],
    () => searchProducts({ search: debounced, limit: 25 }),
    { keepPreviousData: true }
  );

  const needs = useMemo(() => needsQuery.data?.data || [], [needsQuery.data]);
  const refills = useMemo(() => refillQuery.data?.data || [], [refillQuery.data]);
  const products = useMemo(() => productsQuery.data?.data || [], [productsQuery.data]);

  const onBatch = useMemo(() => new Set(lines.map((line) => line.orderItemId).filter(Boolean)), [lines]);
  const refillOnBatch = useMemo(
    () => new Set(lines.filter((line) => line.kind === 'refill').map((line) => line.variation)),
    [lines]
  );

  // A row already planned into another draft batch is not offered: planning it
  // twice made the same customer's piece twice.
  const plannedElsewhere = needs.filter((need) => need.productionBatch).length;
  const term = filter.trim().toLowerCase();
  const matches = (...values) =>
    !term ||
    values.some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(term)
    );
  const promised = (need) => (need.deliveryDate ? new Date(need.deliveryDate).getTime() : Number.POSITIVE_INFINITY);
  // Earliest promise first; un-promised rows last; ties by when they were ordered.
  const waitingOrders = needs
    .filter((need) => !need.productionBatch && !onBatch.has(oid(need)))
    .sort((a, b) => promised(a) - promised(b) || new Date(a.createdAt) - new Date(b.createdAt));
  const waitingRefills = refills.filter((row) => !refillOnBatch.has(row.variationId));
  const shownOrders = waitingOrders.filter((need) =>
    matches(need.orderNo, needName(need), catalogCode(need.product, need.variation), variationLabel(need.variation))
  );
  // Pieces of one order sit together under that order, in the position of its
  // earliest promise — the list is already sorted, so the first appearance of
  // an order number is where its group goes.
  const groupedOrders = new Map();
  shownOrders.forEach((need) => {
    const key = String(need.orderNo);
    if (!groupedOrders.has(key)) groupedOrders.set(key, []);
    groupedOrders.get(key).push(need);
  });
  const orderGroups = [...groupedOrders.entries()].map(([orderNo, items]) => ({ orderNo, items }));
  const shownRefills = waitingRefills.filter((row) => matches(row.productName, row.productCode, row.sku));
  const overdue = waitingOrders.filter((need) => dueMeta(need.deliveryDate).overdue);

  /* ── building lines ───────────────────────────────────────────────────── */

  // Keys from a counter, not Date.now(): a scanner can fire twice in the same
  // millisecond, and two rows sharing a key is a rendering bug.
  const nextKey = useRef(0);
  const newKey = (prefix) => {
    nextKey.current += 1;
    return `${prefix}-${nextKey.current}`;
  };

  // The row a repeat scan touched lights up, so "one more" is visible.
  const [flashKey, setFlashKey] = useState(null);
  const flashTimer = useRef(null);
  const flash = (key) => {
    setFlashKey(key);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashKey(null), 700);
  };
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const setLine = (key, patch) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const orderLine = (need) => ({
    // An order row can be on the batch once, so its own id is a stable key.
    key: `order-${oid(need)}`,
    kind: 'order',
    orderItemId: oid(need),
    orderNo: need.orderNo,
    due: need.deliveryDate,
    isCustom: Boolean(need.isCustom),
    productName: needName(need),
    code: catalogCode(need.product, need.variation),
    variationName: variationLabel(need.variation),
    quantity: 1,
    note: need.customizeDetails || ''
  });

  const refillLine = (row) => ({
    key: `refill-${row.variationId}`,
    kind: 'refill',
    product: row.productId,
    variation: row.variationId,
    productName: row.productName,
    code: catalogCode({ code: row.productCode }, { productionCode: row.productionCode }) || displaySku(row.sku),
    variationName: `Refill to ${row.targetStock}`,
    quantity: row.suggestedQuantity,
    note: ''
  });

  const addOrders = (list) => {
    if (!list.length) return;
    setLines((current) => [...current, ...list.map(orderLine)]);
  };

  const addRefills = (list) => {
    if (!list.length) return;
    setLines((current) => [...current, ...list.map(refillLine)]);
  };

  // Catalogue rows for the search bar — one per variation, as a purchase does.
  const options = useMemo(() => {
    const rows = [];
    products.forEach((product) => {
      const variations = product.variations || [];
      const base = {
        product: oid(product),
        productName: product.name,
        code: product.code ? `#${product.code}` : ''
      };
      if (!variations.length) {
        rows.push({
          ...base,
          key: `${oid(product)}:`,
          title: product.name,
          subtitle: 'Base product',
          meta: base.code,
          variation: '',
          variationName: 'Base product'
        });
        return;
      }
      variations.forEach((variation) => {
        rows.push({
          ...base,
          key: `${oid(product)}:${oid(variation)}`,
          title: product.name,
          subtitle: variationLabel(variation),
          meta: base.code,
          variation: oid(variation),
          variationName: variationLabel(variation)
        });
      });
    });
    return rows;
  }, [products]);

  const addStock = (option) => {
    const match = lines.find(
      (line) => line.kind === 'stock' && line.product === option.product && line.variation === option.variation
    );
    if (match) {
      setLine(match.key, { quantity: num(match.quantity) + 1 });
      flash(match.key);
      return;
    }
    const key = newKey('stock');
    setLines((current) => [
      ...current,
      {
        key,
        kind: 'stock',
        product: option.product,
        variation: option.variation,
        productName: option.productName,
        code: option.code,
        variationName: option.variationName,
        quantity: 1,
        note: ''
      }
    ]);
    flash(key);
  };

  /* ── totals and checks ───────────────────────────────────────────────── */

  const forCustomers = lines.filter((line) => line.kind === 'order').length;
  const forStock = lines.filter((line) => line.kind !== 'order').reduce((sum, line) => sum + num(line.quantity), 0);
  const pieces = forCustomers + forStock;
  const customPieces = lines.filter((line) => line.isCustom).length;

  const problems = useMemo(() => {
    const list = [];
    if (!lines.length) list.push('Add at least one line — press + on the work waiting, or search for a product.');
    lines.forEach((line) => {
      if (line.kind !== 'order' && (!Number.isInteger(num(line.quantity)) || num(line.quantity) < 1)) {
        list.push(`${line.productName}: pieces must be a whole number, at least 1.`);
      }
    });
    return list;
  }, [lines]);

  const save = useMutation(
    () =>
      createProductionBatch({
        note,
        items: lines.map((line) =>
          line.kind === 'order'
            ? { orderItem: line.orderItemId, note: line.note }
            : {
                product: line.product,
                variation: line.variation || null,
                quantity: num(line.quantity),
                note: line.note || (line.kind === 'refill' ? line.variationName : '')
              }
        )
      }),
    {
      onSuccess: (response) => {
        toast(`Draft ${response?.data?.batchNo || 'batch'} created`);
        queryClient.invalidateQueries('production-batches');
        queryClient.invalidateQueries('production-needs');
        queryClient.invalidateQueries('production-replenishment');
        const batchNo = response?.data?.batchNo;
        router.push(batchNo ? `/production/batches/${batchNo}` : '/production');
      },
      onError: (error) => errorAlert('The batch could not be created', error)
    }
  );

  /* ── work waiting ────────────────────────────────────────────────────── */

  const tabButton = (key, label, count) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
        tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {label} <span className="ml-0.5 tabular-nums text-slate-400">{qty(count)}</span>
    </button>
  );

  const waitingLoading = tab === 'orders' ? needsQuery.isLoading : refillQuery.isLoading;
  const shown = tab === 'orders' ? shownOrders : shownRefills;

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Production"
        title="New batch"
        subtitle="Saved as a draft. Starting it checks materials and issues the barcodes."
        back={() => router.push('/production')}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* the batch ─────────────────────────────────────────────────────── */}
        <div className="min-w-0">
          <Section title="This batch" icon={LuFactory} hint="Draft">
            <DocketSearch
              value={search}
              onChange={setSearch}
              options={options}
              onPick={addStock}
              loading={productsQuery.isFetching && debounced !== ''}
              ready={debounced === search.trim() && !productsQuery.isFetching}
              placeholder="Make for stock — scan a barcode, or search by name or code…"
              emptyHint={debounced ? 'No product matches that.' : 'Start typing a product name or code.'}
            />

            <DocketTable head={HEAD}>
              {lines.length ? (
                lines.map((line, index) => {
                  const due = line.kind === 'order' ? dueMeta(line.due) : null;
                  return (
                    <DocketRow
                      key={line.key}
                      index={index}
                      flash={flashKey === line.key}
                      onRemove={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-800">
                          {line.productName}
                          {line.code ? (
                            <span className="ops-code ml-2 text-[11px] text-slate-400">{line.code}</span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-slate-400">{line.variationName}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <Pill tone={KIND[line.kind].tone}>
                            {line.kind === 'order' ? `Order #${line.orderNo}` : KIND[line.kind].label}
                          </Pill>
                          {line.isCustom ? <Pill tone="info">Custom</Pill> : null}
                          {due ? <Pill tone={due.tone}>{due.text}</Pill> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          value={line.note}
                          onChange={(event) => setLine(line.key, { note: event.target.value })}
                          placeholder={line.kind === 'order' ? 'Measurements and instructions' : 'Optional'}
                          className="input-ui h-9 w-full min-w-[200px] text-[12px]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {line.kind === 'order' ? (
                          // One customer's piece is one piece.
                          <span className="inline-block w-20 pr-3 text-right text-[13px] font-semibold tabular-nums text-slate-700">
                            1
                          </span>
                        ) : (
                          <CellInput
                            value={line.quantity}
                            min={1}
                            width="w-20"
                            onChange={(value) => setLine(line.key, { quantity: value })}
                            invalid={!Number.isInteger(num(line.quantity)) || num(line.quantity) < 1}
                          />
                        )}
                      </td>
                    </DocketRow>
                  );
                })
              ) : (
                <DocketEmpty colSpan={HEAD.length + 2}>
                  Nothing on this batch yet — press + on the work waiting, or search for a product to make for stock.
                </DocketEmpty>
              )}
            </DocketTable>

            <DocketCount lines={lines.length} units={pieces}>
              <span>
                {qty(forCustomers)} for customers · {qty(forStock)} for stock
              </span>
            </DocketCount>

            <DocketFoot
              adjustments={
                <>
                  <DocketField
                    label="Batch note"
                    hint="Seen by the floor on the batch page — instructions, deadline, fabric."
                  >
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Anything the floor needs to know about this run"
                      className={`${fieldClass} resize-none`}
                    />
                  </DocketField>
                  {problems.length ? (
                    <Notice tone="warn" icon={FiAlertTriangle} title="Before this can be saved">
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {problems.slice(0, 5).map((problem) => (
                          <li key={problem}>{problem}</li>
                        ))}
                      </ul>
                    </Notice>
                  ) : null}
                </>
              }
              totals={
                <>
                  <SummaryRow label="For customers" value={forCustomers} />
                  <SummaryRow label="For stock" value={forStock} />
                  {customPieces ? <SummaryRow label="Custom pieces" value={customPieces} /> : null}
                  <SummaryRow label="Pieces to make" value={pieces} strong />
                </>
              }
            >
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isLoading || problems.length > 0}
                className="btn-brand mt-3 h-11 w-full"
              >
                <FiSave size={15} /> {save.isLoading ? 'Saving…' : 'Save draft batch'}
              </button>
            </DocketFoot>
          </Section>
        </div>

        {/* work waiting — narrow, and scrolls on its own ────────────────── */}
        <aside className="card-ui flex flex-col overflow-hidden xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)]">
          <header className="space-y-2 border-b border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-600">Work waiting</h2>
              {tab === 'orders' && overdue.length ? (
                <button
                  type="button"
                  onClick={() => addOrders(overdue)}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  + Add {overdue.length} overdue
                </button>
              ) : null}
            </div>
            <div className="flex rounded-md border border-slate-200 bg-slate-100 p-0.5">
              {tabButton('orders', 'Customers', waitingOrders.length)}
              {tabButton('refill', 'Shelf refill', waitingRefills.length)}
            </div>
            <div className="relative">
              <FiSearch
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={13}
              />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={tab === 'orders' ? 'Filter by order or product…' : 'Filter by product…'}
                className="input-ui h-8 w-full pl-7 text-[12px]"
                aria-label="Filter the work waiting"
              />
            </div>
            {tab === 'orders' ? (
              <p className="text-[11px] text-slate-400">
                Earliest promise first
                {plannedElsewhere ? ` · ${plannedElsewhere} already in a draft batch` : ''}
              </p>
            ) : null}
          </header>

          <ul className="max-h-[480px] min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto xl:max-h-none">
            {waitingLoading ? (
              <li className="px-4 py-10 text-center text-sm text-slate-400">Loading…</li>
            ) : !shown.length ? (
              <li className="px-4 py-10 text-center">
                <FiCheck className="mx-auto mb-1.5 text-xl text-slate-300" />
                <p className="text-[13px] font-semibold text-slate-600">
                  {term
                    ? 'Nothing matches that'
                    : tab === 'orders'
                      ? 'No customer is waiting'
                      : 'Every shelf is above its minimum'}
                </p>
              </li>
            ) : tab === 'orders' ? (
              orderGroups.map(({ orderNo, items }) => {
                const due = dueMeta(items[0].deliveryDate);
                const single = items.length === 1;
                return (
                  <li key={orderNo} className="px-3 py-2.5">
                    {/* The order: its promise, and — when it has several
                        pieces — one press to add them all. */}
                    <div className="flex items-center gap-1.5">
                      <Pill tone={due.tone}>{due.text}</Pill>
                      <span className="ops-code text-[12px] font-bold text-slate-700">#{orderNo}</span>
                      {single ? null : (
                        <>
                          <span className="text-[11px] text-slate-400">{items.length} pieces</span>
                          <button
                            type="button"
                            onClick={() => addOrders(items)}
                            className="ml-auto text-[11px] font-semibold text-[var(--brand-strong)] hover:underline"
                            aria-label={`Add all ${items.length} pieces of order ${orderNo}`}
                          >
                            + Add all
                          </button>
                        </>
                      )}
                    </div>
                    <ul className={single ? 'mt-1' : 'mt-1.5 space-y-1.5 border-l-2 border-slate-200 pl-2.5'}>
                      {items.map((need) => {
                        const code = catalogCode(need.product, need.variation);
                        const variation = variationLabel(need.variation);
                        return (
                          <li key={oid(need)} className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-slate-800">
                                {needName(need)}
                                {need.isCustom ? (
                                  <Pill tone="info" className="ml-1.5 align-middle">
                                    Custom
                                  </Pill>
                                ) : null}
                              </p>
                              {code || variation ? (
                                <p className="truncate text-[11px] text-slate-500">
                                  {[code, variation].filter(Boolean).join(' · ')}
                                </p>
                              ) : null}
                              {need.customizeDetails ? (
                                <p className="truncate text-[11px] text-amber-700" title={need.customizeDetails}>
                                  {need.customizeDetails}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => addOrders([need])}
                              className="btn-brand h-8 w-8 shrink-0 !p-0"
                              aria-label={`Add ${needName(need)} from order ${orderNo} to the batch`}
                              title="Add to batch"
                            >
                              <FiPlus size={15} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })
            ) : (
              shownRefills.map((row) => (
                <li key={row.variationId} className="flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">{row.productName}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      <span className={row.freeStock <= 0 ? 'font-semibold text-rose-600' : ''}>
                        {row.freeStock} free
                      </span>
                      {` · min ${row.minStock} · target ${row.targetStock}`}
                    </p>
                    {row.inProduction || row.plannedInDrafts || row.waitingDemand ? (
                      <p className="truncate text-[11px] text-slate-400">
                        {[
                          row.inProduction ? `${row.inProduction} being made` : null,
                          row.plannedInDrafts ? `${row.plannedInDrafts} planned` : null,
                          row.waitingDemand ? `${row.waitingDemand} owed` : null
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => addRefills([row])}
                      className="btn-brand h-8 !px-2.5 !text-xs"
                      aria-label={`Add ${row.suggestedQuantity} of ${row.productName} to the batch`}
                    >
                      <FiPlus size={13} /> {row.suggestedQuantity}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/** A count row in the docket's totals block (DocketTotalRow formats money). */
function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-6 ${strong ? 'border-t border-slate-200 pt-2' : ''}`}>
      <span className={strong ? 'text-[13px] font-bold text-slate-900' : 'text-[13px] text-slate-500'}>{label}</span>
      <span
        className={`tabular-nums ${strong ? 'text-lg font-black text-slate-900' : 'text-[13px] font-semibold text-slate-700'}`}
      >
        {qty(value)}
      </span>
    </div>
  );
}
