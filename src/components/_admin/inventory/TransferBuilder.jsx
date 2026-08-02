'use client';

/**
 * New transfer — build the docket, then save it as a draft.
 *
 * The old version of this form sat on top of the register and asked for five
 * dropdowns per line before it would say whether the stock even existed. Here
 * the route is chosen first, because the route decides everything else: it
 * determines which stock is reachable, whether a lot must be named, and what
 * "available" means. Products are then searched and added one at a time, and
 * each line states how many are actually free at the source.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FiAlertTriangle, FiArrowRight, FiPlus, FiRepeat, FiSearch, FiTrash2, FiTruck } from 'react-icons/fi';

import { adminGetBranches, createStockTransfer, getStockLots } from 'src/services';
import {
  EmptyRow,
  Field,
  Notice,
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
import GlobalTable from 'src/components/_admin/ui/GlobalTable';
import { variationLabel } from './shared';

const lotFree = (lot) => Math.max(0, Number(lot.onHandQuantity || 0) - Number(lot.reservedQuantity || 0));

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
  // Leaving a branch means naming the exact lot; HQ issues stock FIFO and the
  // server picks the lots itself.
  const needsLot = sourceBranch?.type === 'BRANCH';

  /**
   * The picker is built from the source's own lots rather than the product
   * catalogue, so it can only ever offer stock that is actually standing there.
   * Searching a catalogue and then discovering there is none of it is the
   * slowest possible way to fill in a docket.
   */
  const stockAtSource = useMemo(() => {
    const map = new Map();
    lots.forEach((lot) => {
      const key = `${oid(lot.product)}:${oid(lot.variation)}`;
      const entry = map.get(key) || {
        key,
        product: oid(lot.product),
        variation: oid(lot.variation),
        productName: lot.product?.name || 'Unknown product',
        productCode: lot.product?.code,
        variationName: lot.variation ? variationLabel(lot.variation) : 'Base product',
        free: 0
      };
      entry.free += lotFree(lot);
      map.set(key, entry);
    });
    return [...map.values()].filter((entry) => entry.free > 0).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [lots]);

  const freeAtSource = useMemo(
    () => new Map(stockAtSource.map((entry) => [entry.key, entry.free])),
    [stockAtSource]
  );

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return stockAtSource;
    return stockAtSource.filter(
      (entry) =>
        entry.productName.toLowerCase().includes(term) ||
        entry.variationName.toLowerCase().includes(term) ||
        String(entry.productCode || '').includes(term)
    );
  }, [stockAtSource, search]);

  const lotsFor = (line) =>
    lots.filter(
      (lot) => oid(lot.product) === line.product && oid(lot.variation) === String(line.variation || '') && lotFree(lot) > 0
    );

  const addLine = (entry) => {
    if (lines.some((line) => `${line.product}:${line.variation}` === entry.key)) {
      return toast('That product is already on the docket');
    }
    return setLines((current) => [
      ...current,
      {
        key: `${entry.key}-${Date.now()}`,
        product: entry.product,
        variation: entry.variation,
        productName: entry.productName,
        variationName: entry.variationName,
        sourceLot: '',
        quantity: 1
      }
    ]);
  };

  const setLine = (key, patch) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const totalPieces = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);

  const problems = useMemo(() => {
    const list = [];
    if (!route.source || !route.destination) list.push('Choose where the stock is coming from and going to.');
    if (route.source && route.source === route.destination) list.push('Source and destination must be different branches.');
    if (!lines.length) list.push('Add at least one product.');
    lines.forEach((line) => {
      if (!(Number(line.quantity) >= 1)) list.push(`${line.productName}: quantity must be at least 1.`);
      if (needsLot && !line.sourceLot) list.push(`${line.productName}: choose the source stock lot.`);
      const free = freeAtSource.get(`${line.product}:${line.variation}`) || 0;
      if (Number(line.quantity) > free) {
        list.push(`${line.productName}: only ${free} free at ${sourceBranch?.name || 'the source'}.`);
      }
    });
    return list;
  }, [route, lines, needsLot, freeAtSource, sourceBranch]);

  const save = useMutation(
    () =>
      createStockTransfer({
        sourceBranch: route.source,
        destinationBranch: route.destination,
        note,
        lines: lines.map((line) => ({
          product: line.product,
          variation: line.variation || null,
          sourceLot: line.sourceLot || null,
          quantity: Number(line.quantity)
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

  return (
    <div className="space-y-4">
      <PageBar
        eyebrow="Transfers"
        title="New transfer"
        subtitle="Saved as a draft — approving, dispatching and receiving happen from the register."
        back={() => router.push('/inventory/transfers')}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* 1 — route */}
          <Section title="1 · Route" icon={FiTruck}>
            <SectionBody>
              <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
                <Field label="From">
                  <select
                    className={fieldClass}
                    value={route.source}
                    onChange={(event) => {
                      setRoute((current) => ({ ...current, source: event.target.value }));
                      setLines((current) => current.map((line) => ({ ...line, sourceLot: '' })));
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
                </Field>
                <button
                  type="button"
                  onClick={() => setRoute((current) => ({ source: current.destination, destination: current.source }))}
                  className="btn-icon mb-1 hidden md:inline-flex"
                  title="Swap source and destination"
                  aria-label="Swap source and destination"
                >
                  <FiRepeat size={15} />
                </button>
                <Field label="To">
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
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Note" hint="Optional — who is carrying it, or why.">
                  <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
              </div>
              {route.source ? (
                <p className="mt-3 text-xs text-slate-500">
                  {needsLot
                    ? 'Stock leaving a branch must name the exact lot it comes from.'
                    : 'HQ issues stock FIFO — the oldest lots are used automatically.'}
                </p>
              ) : null}
            </SectionBody>
          </Section>

          {/* 2 — products */}
          <Section
            title="2 · Products"
            icon={FiPlus}
            hint={route.source ? `${matches.length} available at ${sourceBranch?.name}` : 'Choose a source branch first'}
            actions={
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search what's in stock…"
                  className="input-ui w-52 pl-8"
                  aria-label="Search stock at the source branch"
                  disabled={!route.source}
                />
              </div>
            }
          >
            <SectionBody className="max-h-80 overflow-y-auto p-0">
              {!route.source ? (
                <p className="p-6 text-center text-sm text-slate-400">
                  Pick where the stock is coming from, and everything standing there appears here.
                </p>
              ) : lotsQuery.isLoading ? (
                <p className="p-6 text-center text-sm text-slate-400">Loading stock at {sourceBranch?.name}…</p>
              ) : matches.length ? (
                <ul className="divide-y divide-slate-100">
                  {matches.map((entry) => {
                    const added = lines.some((line) => `${line.product}:${line.variation}` === entry.key);
                    return (
                      <li key={entry.key} className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-slate-800">
                            {entry.productName}
                            {entry.productCode ? (
                              <span className="ops-code ml-2 text-[11px] text-slate-400">#{entry.productCode}</span>
                            ) : null}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">{entry.variationName}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Pill tone="good">{qty(entry.free)} free</Pill>
                          <button
                            type="button"
                            disabled={added}
                            onClick={() => addLine(entry)}
                            className="btn-ghost h-8 !px-2.5 !text-xs"
                          >
                            <FiPlus size={13} /> {added ? 'Added' : 'Add'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-6 text-center text-sm text-slate-400">
                  {search ? 'Nothing here matches that search.' : `${sourceBranch?.name} has no free stock to send.`}
                </p>
              )}
            </SectionBody>
          </Section>
        </div>

        {/* 3 — the docket */}
        <aside className="space-y-4">
          <StatTile
            label="On this docket"
            value={qty(totalPieces)}
            note={`${lines.length} line${lines.length === 1 ? '' : 's'}`}
            tone={totalPieces ? 'default' : 'muted'}
          />

          <Section title="3 · Docket" icon={FiArrowRight} hint={sourceBranch?.name}>
            <GlobalTable>
              <thead>
                <tr>
                  <th>Product</th>
                  {needsLot ? <th>Lot</th> : null}
                  <th className="w-20 text-right">Qty</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.length ? (
                  lines.map((line) => {
                    const free = freeAtSource.get(`${line.product}:${line.variation}`) || 0;
                    const over = Number(line.quantity) > free;
                    return (
                      <tr key={line.key}>
                        <td>
                          <p className="text-[13px] font-medium text-slate-800">{line.productName}</p>
                          <p className="text-[11px] text-slate-400">{line.variationName}</p>
                          <p className={`text-[11px] font-semibold ${over ? 'text-rose-600' : 'text-slate-400'}`}>
                            {qty(free)} free at source
                          </p>
                        </td>
                        {needsLot ? (
                          <td>
                            <select
                              value={line.sourceLot}
                              onChange={(event) => setLine(line.key, { sourceLot: event.target.value })}
                              className="select-ui w-full !text-xs"
                            >
                              <option value="">Choose lot…</option>
                              {lotsFor(line).map((lot) => (
                                <option key={oid(lot)} value={oid(lot)}>
                                  {qty(lotFree(lot))} available
                                </option>
                              ))}
                            </select>
                          </td>
                        ) : null}
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(event) => setLine(line.key, { quantity: Number(event.target.value) })}
                            className={`input-ui text-right tabular-nums ${over ? '!border-rose-300' : ''}`}
                          />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                            aria-label={`Remove ${line.productName}`}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <EmptyRow colSpan={needsLot ? 4 : 3} title="Nothing added yet" hint="Add products from the list." />
                )}
              </tbody>
            </GlobalTable>
          </Section>

          {problems.length ? (
            <Notice tone="warn" icon={FiAlertTriangle} title="Before this can be saved">
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {problems.slice(0, 5).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isLoading || problems.length > 0}
            className="btn-brand h-11 w-full"
          >
            {save.isLoading ? 'Saving…' : 'Save draft transfer'}
          </button>
        </aside>
      </div>
    </div>
  );
}
