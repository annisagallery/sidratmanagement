'use client';

/**
 * New transfer — the old POS's transfer docket.
 *
 * Same shape as the purchase screen, and for the same reason: header fields
 * across the top, one wide search box, one wide table, totals bottom-right.
 * Purchases and transfers were the same screen with different columns in the
 * old POS, everyone who works here learned that shape, and there is nothing
 * about moving stock between branches that needs a different one.
 *
 * What the old POS did not do, and this keeps: the route is chosen first,
 * because the route decides what stock is even reachable. The search box is fed
 * by what is physically standing at the source rather than by the catalogue —
 * searching a catalogue and then finding out there is none of it is the slowest
 * possible way to fill in a docket.
 *
 * A line is a product and a quantity, nothing else. Transfers out of a branch
 * used to make whoever filled this in name the exact stock lot per line, which
 * asked a bookkeeping question nobody on the floor can answer: the lots are
 * indistinguishable on the shelf. The server allocates FIFO, oldest lot first,
 * and splits across as many as the quantity needs.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FiAlertTriangle, FiRepeat, FiSave } from 'react-icons/fi';

import { adminGetBranches, createStockTransfer, getStockLots } from 'src/services';
import {
  CellInput,
  DocketCount,
  DocketEmpty,
  DocketField,
  DocketFoot,
  DocketHeader,
  DocketRow,
  DocketSearch,
  DocketTable,
  DocketTotalRow
} from 'src/components/_admin/ui/docket';
import {
  Notice,
  PageBar,
  Section,
  errorAlert,
  fieldClass,
  money,
  oid,
  qty,
  toast
} from 'src/components/_admin/ui/primitives';
import { variationLabel } from './shared';

const lotFree = (lot) => Math.max(0, Number(lot.onHandQuantity || 0) - Number(lot.reservedQuantity || 0));
const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const todayValue = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function TransferBuilder() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [route, setRoute] = useState({ source: '', destination: '' });
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([]);
  const [search, setSearch] = useState('');

  const branchesQuery = useQuery('inventory-branches', adminGetBranches);
  const lotsQuery = useQuery(
    ['inventory-source-lots', route.source],
    () => getStockLots({ branch: route.source, status: 'ACTIVE' }),
    { enabled: Boolean(route.source) }
  );

  const branches = branchesQuery.data?.data || [];
  const lots = useMemo(() => lotsQuery.data?.data || [], [lotsQuery.data]);

  const sourceBranch = branches.find((branch) => oid(branch) === route.source);

  /**
   * The source's lots, folded into one row per product/variation.
   *
   * Keyed off the lot's own `productId` / `variationId` columns rather than
   * `lot.product.id`. Those columns are on every row unconditionally; the
   * nested objects are a `select` on the endpoint, and when that select once
   * omitted `id` every key here evaluated to the same empty string — so all
   * 1,200 lots at a branch folded into a single row carrying the whole
   * branch's quantity and whichever lot's price came back first. Reading the
   * foreign key cannot fail that way.
   */
  const stockAtSource = useMemo(() => {
    const map = new Map();
    lots.forEach((lot) => {
      const productId = lot.productId || oid(lot.product);
      const variationId = lot.variationId || oid(lot.variation);
      if (!productId) return;

      const key = `${productId}:${variationId}`;
      const entry = map.get(key) || {
        key,
        product: productId,
        variation: variationId,
        productName: lot.product?.name || 'Unknown product',
        productCode: lot.product?.code,
        variationName: lot.variation ? variationLabel(lot.variation) : 'Base product',
        free: 0,
        // What the source carries this stock at, so the docket can be valued
        // the way the old POS valued one. Every lot of a given variation is
        // priced the same in practice; an unpriced one leaves the line at zero
        // rather than inventing a figure.
        unitPrice: 0
      };
      entry.free += lotFree(lot);
      if (!entry.unitPrice && lot.salePrice) entry.unitPrice = Number(lot.salePrice);
      map.set(key, entry);
    });
    return [...map.values()].filter((entry) => entry.free > 0).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [lots]);

  const freeAtSource = useMemo(() => new Map(stockAtSource.map((entry) => [entry.key, entry.free])), [stockAtSource]);

  const options = useMemo(() => {
    const term = search.trim().toLowerCase();
    const taken = new Set(lines.map((line) => `${line.product}:${line.variation}`));
    return stockAtSource
      .filter(
        (entry) =>
          !term ||
          entry.productName.toLowerCase().includes(term) ||
          entry.variationName.toLowerCase().includes(term) ||
          String(entry.productCode || '').includes(term)
      )
      .map((entry) => ({
        ...entry,
        disabled: taken.has(entry.key),
        title: entry.productName,
        subtitle: entry.variationName,
        meta: `${qty(entry.free)} free`
      }));
  }, [stockAtSource, search, lines]);

  const addLine = (entry) =>
    setLines((current) => [
      ...current,
      {
        key: `${entry.key}-${Date.now()}`,
        product: entry.product,
        variation: entry.variation,
        productName: entry.productName,
        productCode: entry.productCode,
        variationName: entry.variationName,
        quantity: 1,
        unitPrice: entry.unitPrice || 0
      }
    ]);

  const setLine = (key, patch) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const priced = lines.map((line) => ({ ...line, subTotal: num(line.quantity) * num(line.unitPrice) }));
  const units = priced.reduce((sum, line) => sum + num(line.quantity), 0);
  const value = priced.reduce((sum, line) => sum + line.subTotal, 0);

  const problems = useMemo(() => {
    const list = [];
    if (!route.source || !route.destination) list.push('Choose where the stock is coming from and going to.');
    if (route.source && route.source === route.destination) list.push('Source and destination must be different branches.');
    if (!lines.length) list.push('Add at least one product.');
    lines.forEach((line) => {
      if (num(line.quantity) < 1) list.push(`${line.productName}: quantity must be at least 1.`);
      const free = freeAtSource.get(`${line.product}:${line.variation}`) || 0;
      if (num(line.quantity) > free) {
        list.push(`${line.productName}: only ${free} free at ${sourceBranch?.name || 'the source'}.`);
      }
    });
    return list;
  }, [route, lines, freeAtSource, sourceBranch]);

  const save = useMutation(
    () =>
      createStockTransfer({
        sourceBranch: route.source,
        destinationBranch: route.destination,
        note,
        lines: lines.map((line) => ({
          product: line.product,
          variation: line.variation || null,
          quantity: num(line.quantity)
        }))
      }),
    {
      onSuccess: (response) => {
        toast(`Draft ${response?.data?.transferNo || 'transfer'} created`);
        queryClient.invalidateQueries('inventory-transfers');
        router.push('/inventory/transfers');
      },
      onError: (error) => errorAlert('The transfer could not be saved', error)
    }
  );

  const head = [
    { label: 'Product' },
    { label: 'Shelf price', className: 'text-right' },
    { label: 'Quantity', className: 'text-right' },
    { label: 'Subtotal', className: 'text-right' }
  ];

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Transfers"
        title="Add transfer"
        subtitle="Saved as a draft — approving, dispatching and receiving happen from the transfer list."
        back={() => router.push('/inventory/transfers')}
      />

      <Section title="New transfer">
        <DocketHeader columns={4}>
          <DocketField label="Date" hint="Set when the draft is created.">
            <input type="date" value={todayValue()} readOnly disabled className={fieldClass} />
          </DocketField>

          <DocketField label="From" required>
            <select
              className={fieldClass}
              value={route.source}
              onChange={(event) => {
                setRoute((current) => ({ ...current, source: event.target.value }));
                // Lots belong to the old source, so they cannot survive the change.
                setLines([]);
              }}
            >
              <option value="">Choose the source…</option>
              {branches.map((branch) => (
                <option key={oid(branch)} value={oid(branch)}>
                  {branch.name}
                  {branch.isProductionDestination ? ' (HQ)' : ''}
                </option>
              ))}
            </select>
          </DocketField>

          <DocketField label="To" required>
            <div className="flex items-center gap-2">
              <select
                className={fieldClass}
                value={route.destination}
                onChange={(event) => setRoute((current) => ({ ...current, destination: event.target.value }))}
              >
                <option value="">Choose the destination…</option>
                {branches.map((branch) => (
                  <option key={oid(branch)} value={oid(branch)} disabled={oid(branch) === route.source}>
                    {branch.name}
                    {branch.isProductionDestination ? ' (HQ)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setRoute((current) => ({ source: current.destination, destination: current.source }));
                  setLines([]);
                }}
                className="btn-icon shrink-0"
                title="Swap source and destination"
                aria-label="Swap source and destination"
              >
                <FiRepeat size={15} />
              </button>
            </div>
          </DocketField>

          <DocketField label="Status" hint="Drafts are approved and dispatched from the list.">
            <input value="Draft" readOnly disabled className={fieldClass} />
          </DocketField>
        </DocketHeader>

        <DocketSearch
          value={search}
          onChange={setSearch}
          options={options}
          onPick={addLine}
          disabled={!route.source}
          loading={lotsQuery.isLoading && Boolean(route.source)}
          placeholder={`Add product from ${sourceBranch?.name || 'the source'}…`}
          disabledHint="Choose where the stock is coming from first"
          emptyHint={
            search ? 'Nothing in stock there matches that.' : `${sourceBranch?.name || 'The source'} has no free stock to send.`
          }
        />

        {route.source ? (
          <p className="border-b border-slate-200 bg-slate-50/50 px-4 py-2 text-[11px] text-slate-500">
            Stock is taken oldest first — you name the product and the quantity, the system picks which stock goes.
          </p>
        ) : null}

        <DocketTable head={head}>
          {priced.length ? (
            priced.map((line, index) => {
              const free = freeAtSource.get(`${line.product}:${line.variation}`) || 0;
              const over = num(line.quantity) > free;
              return (
                <DocketRow
                  key={line.key}
                  index={index}
                  onRemove={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                >
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">
                      {line.productName}
                      {line.productCode ? (
                        <span className="ops-code ml-2 text-[11px] text-slate-400">#{line.productCode}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-slate-400">{line.variationName}</p>
                    <p className={`text-[11px] font-semibold ${over ? 'text-rose-600' : 'text-slate-400'}`}>
                      {qty(free)} free at source
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-slate-600">
                    {line.unitPrice ? money(line.unitPrice) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <CellInput
                      value={line.quantity}
                      min={1}
                      width="w-20"
                      onChange={(value_) => setLine(line.key, { quantity: value_ })}
                      invalid={over || num(line.quantity) < 1}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] font-bold tabular-nums text-slate-800">
                    {line.subTotal ? money(line.subTotal) : <span className="text-slate-300">—</span>}
                  </td>
                </DocketRow>
              );
            })
          ) : (
            <DocketEmpty colSpan={head.length + 2}>
              {route.source
                ? 'Nothing on this docket yet — search above to add the first product.'
                : 'Pick where the stock is coming from, and everything standing there becomes searchable.'}
            </DocketEmpty>
          )}
        </DocketTable>

        <DocketCount lines={priced.length} units={units}>
          <span>Value {money(value)}</span>
        </DocketCount>

        <DocketFoot
          adjustments={
            <>
              <DocketField label="Note" hint="Optional — who is carrying it, or why.">
                <textarea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className={fieldClass}
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
              <DocketTotalRow label={`Units (${qty(units)})`} value={value} />
              <DocketTotalRow label="Total value" value={value} strong />
            </>
          }
        >
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isLoading || problems.length > 0}
            className="btn-brand mt-3 h-11 w-full"
          >
            <FiSave size={15} /> {save.isLoading ? 'Saving…' : 'Save draft transfer'}
          </button>
        </DocketFoot>
      </Section>
    </div>
  );
}
