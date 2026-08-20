'use client';

/**
 * The product material sheet.
 *
 * Structured around one rule that has to be legible at a glance: the base BOM
 * applies to every variation, always. It is not a scope you switch away from.
 *
 * The original screen had a single "product option" dropdown and one table.
 * Choosing a variation loaded the *merged* list — base lines included — and
 * saving wrote all of it back as that variation's own rows. The base was
 * silently copied in, and from then on editing the base no longer reached that
 * variation. Nothing on screen said so.
 *
 * So scopes are picked from tiles rather than a dropdown: the base tile is
 * always visible next to the variations, which is the point — you are not
 * switching away from it, you are adding to it. One configurator below edits
 * whichever tile is selected, and each scope saves on its own.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import {
  MdAdd, MdArrowBack, MdCheck, MdDeleteOutline, MdLayers,
  MdReceiptLong, MdSave, MdTune, MdWarningAmber,
} from 'react-icons/md';

import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { alertError, toastSuccess } from 'src/utils/swal';

const BASE = '__base__';

const qty = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1000) / 1000;

const unitLabel = (material) =>
  material?.unitMode === 'roll_meter' ? 'm' : material?.unit?.name || 'units';

/** Stored row -> editable row. Kept separate so `dirty` comparisons are cheap. */
const toDraft = (line) => ({
  accessoryId: line.accessoryId,
  quantity: Number(line.quantity),
  wastagePercent: Number(line.wastagePercent || 0),
  overridesBase: Boolean(line.overridesBase),
  note: line.note || '',
});

const serialise = (rows) =>
  JSON.stringify(
    [...rows]
      .sort((a, b) => a.accessoryId.localeCompare(b.accessoryId))
      .map((row) => [row.accessoryId, Number(row.quantity), Number(row.wastagePercent || 0), row.overridesBase, row.note]),
  );

/**
 * A scope tile. Same shape as the Presale step's option switches so the two
 * screens read as one flow.
 */
function ScopeTile({ active, primary, title, subtitle, count, dirty, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-2.5 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] ${
        active
          ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          active ? 'bg-[var(--brand)] text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {primary ? <MdLayers size={15} /> : <MdTune size={15} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-slate-800">{title}</span>
          {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved changes" />}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">
          {subtitle ?? `${count} material${count === 1 ? '' : 's'}`}
        </span>
      </span>
    </button>
  );
}

/** One editable material line, full width. */
function MaterialCard({ row, index, materials, usedIds, alsoInBase, onChange, onRemove }) {
  const material = materials.find((item) => item.id === row.accessoryId);
  const perUnit = qty(Number(row.quantity || 0) * (1 + Number(row.wastagePercent || 0) / 100));

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_96px_84px_auto_36px] lg:items-end">
        <label className="min-w-0">
          <span className="section-label mb-1 block">Material</span>
          <select
            className="select-ui w-full font-semibold"
            value={row.accessoryId}
            onChange={(event) => onChange(index, { accessoryId: event.target.value })}
          >
            {materials.map((item) => (
              <option key={item.id} value={item.id} disabled={item.id !== row.accessoryId && usedIds.has(item.id)}>
                {item.name} · {item.code}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="section-label mb-1 block">Per unit</span>
          <input
            type="number"
            min="0.001"
            step="0.001"
            className="input-ui"
            value={row.quantity}
            onChange={(event) => onChange(index, { quantity: event.target.value })}
          />
        </label>

        <label>
          <span className="section-label mb-1 block">Waste %</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className="input-ui"
            value={row.wastagePercent}
            onChange={(event) => onChange(index, { wastagePercent: event.target.value })}
          />
        </label>

        <div className="rounded-md bg-slate-50 px-3 py-2">
          <span className="section-label block">Consumes</span>
          <span className="text-sm font-bold tabular-nums text-slate-800">
            {perUnit} {unitLabel(material)}
          </span>
        </div>

        <button
          type="button"
          className="btn-icon justify-self-end text-red-600"
          aria-label={`Remove ${material?.name || 'material'}`}
          onClick={() => onRemove(index)}
        >
          <MdDeleteOutline size={18} />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            material?.isRepurchasable ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {material?.isRepurchasable ? 'Can be repurchased' : 'Blocks orders when short'}
        </span>

        {alsoInBase && (
          <button
            type="button"
            role="switch"
            aria-checked={row.overridesBase}
            onClick={() => onChange(index, { overridesBase: !row.overridesBase })}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
              row.overridesBase ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
            }`}
          >
            {row.overridesBase && <MdCheck size={12} />}
            {row.overridesBase ? 'Replaces base amount' : 'Adds to base'}
          </button>
        )}

        <input
          className="input-ui !h-8 min-w-0 flex-1 text-[12px]"
          placeholder="Process note"
          value={row.note}
          onChange={(event) => onChange(index, { note: event.target.value })}
        />
      </div>
    </div>
  );
}

// The costing strip that used to sit here (materials cost, production cost,
// unit cost, selling price and profit) is intentionally gone from Management:
// costing is not shared with everyone who can edit a product. The bill of
// materials itself — what a unit consumes — still belongs here; the money
// attached to it is read in the admin portal only.

export default function ProductBom({ slug, embedded = false }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [baseRows, setBaseRows] = useState([]);
  const [variationRows, setVariationRows] = useState({});
  const [scope, setScope] = useState(BASE);
  const [saved, setSaved] = useState({ base: '[]', variations: {} });

  const bomQuery = useQuery(['product-bom', slug], () => api.getProductBom({ slug }), {
    onSuccess: (response) => {
      const data = response?.data;
      if (!data) return;
      const base = (data.base?.lines || []).map(toDraft);
      const perVariation = Object.fromEntries(
        (data.variations || []).map((variation) => [variation.id, (variation.lines || []).map(toDraft)]),
      );
      setBaseRows(base);
      setVariationRows(perVariation);
      setSaved({
        base: serialise(base),
        variations: Object.fromEntries(Object.entries(perVariation).map(([id, rows]) => [id, serialise(rows)])),
      });
    },
  });

  const materialsQuery = useQuery(['bom-materials'], api.getBomMaterials);
  const bom = bomQuery.data?.data;
  const materials = materialsQuery.data?.data || [];
  const variations = useMemo(() => bom?.variations || [], [bom]);

  useEffect(() => {
    if (scope !== BASE && !variations.some((variation) => variation.id === scope)) setScope(BASE);
  }, [variations, scope]);

  const saveMutation = useMutation(api.saveProductBom, {
    onSuccess: (response, sent) => {
      queryClient.setQueryData(['product-bom', slug], response);
      // The catalogue reads production capacity off the BOM.
      queryClient.invalidateQueries(['products']);
      toastSuccess(sent.variationId ? 'Variation materials saved' : 'Base materials saved');
    },
    onError: (error) => alertError(error, { title: 'Could not save materials' }),
  });

  const isBase = scope === BASE;
  const activeVariation = isBase ? null : variations.find((variation) => variation.id === scope) || null;
  const rows = isBase ? baseRows : variationRows[scope] || [];
  const setRows = (updater) => {
    if (isBase) {
      setBaseRows(updater);
      return;
    }
    setVariationRows((current) => ({
      ...current,
      [scope]: typeof updater === 'function' ? updater(current[scope] || []) : updater,
    }));
  };

  const baseAccessoryIds = useMemo(() => new Set(baseRows.map((row) => row.accessoryId)), [baseRows]);
  const usedIds = useMemo(() => new Set(rows.map((row) => row.accessoryId)), [rows]);

  const dirtyFor = (key) =>
    key === BASE
      ? serialise(baseRows) !== saved.base
      : serialise(variationRows[key] || []) !== (saved.variations[key] ?? '[]');
  const dirty = dirtyFor(scope);

  const update = (index, patch) =>
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  const remove = (index) => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  const add = () => {
    const next = materials.find((item) => !usedIds.has(item.id));
    if (!next) return;
    setRows((current) => [
      ...current,
      { accessoryId: next.id, quantity: 1, wastagePercent: 0, overridesBase: false, note: '' },
    ]);
  };

  const save = () =>
    saveMutation.mutate({
      slug,
      variationId: isBase ? null : scope,
      lines: rows.map((row) => ({
        accessoryId: row.accessoryId,
        quantity: Number(row.quantity),
        wastagePercent: Number(row.wastagePercent || 0),
        overridesBase: Boolean(row.overridesBase),
        note: row.note,
      })),
    });

  if (bomQuery.isLoading && !bom) return <div className="card-ui h-[520px] animate-pulse bg-slate-100" />;
  if (bomQuery.isError) {
    return (
      <div className="card-ui p-10 text-center">
        <p className="font-semibold text-red-700">The product material sheet could not be loaded.</p>
        <button className="btn-ghost mt-4" onClick={() => router.push(`/products/${slug}`)}>
          <MdArrowBack /> Back to product
        </button>
      </div>
    );
  }

  const activeScope = isBase ? bom?.base : activeVariation;
  const inherited = (activeVariation?.effective?.lines || []).filter((line) => line.inheritsBase);
  const blockedBy = activeScope?.blockedBy || activeScope?.effective?.blockedBy || [];

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title={`${bom?.product?.name || 'Product'} materials`}
          subtitle="What one finished unit consumes"
          icon={MdReceiptLong}
        >
          <button className="btn-ghost min-h-11" onClick={() => router.push(`/products/${slug}`)}>
            <MdArrowBack size={18} /> Product details
          </button>
        </PageHeader>
      )}

      {/* Scope tiles. The base sits alongside the variations rather than above
          them, because it is not a mode you leave — every variation total
          already includes it. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <ScopeTile
          primary
          active={isBase}
          title="Base — all options"
          subtitle={`${baseRows.length} material${baseRows.length === 1 ? '' : 's'} · applies to every option`}
          dirty={dirtyFor(BASE)}
          onClick={() => setScope(BASE)}
        />
        {variations.map((variation) => {
          const own = (variationRows[variation.id] || []).length;
          return (
            <ScopeTile
              key={variation.id}
              active={scope === variation.id}
              title={variation.label}
              subtitle={own ? `${own} extra material${own === 1 ? '' : 's'}` : 'Base only'}
              dirty={dirtyFor(variation.id)}
              onClick={() => setScope(variation.id)}
            />
          );
        })}
      </div>

      {/* Configurator for the selected tile. */}
      <section className="card-ui overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {isBase ? 'Base materials' : `${activeVariation?.label} — extras`}
            </p>
            <p className="text-[12px] text-slate-500">
              {isBase
                ? 'Used by every option of this product.'
                : 'Added on top of the base for this option only.'}
            </p>
          </div>
          <button type="button" className="btn-brand !min-h-9" onClick={save} disabled={saveMutation.isLoading || !dirty}>
            <MdSave size={16} /> {saveMutation.isLoading ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>

        {!isBase && inherited.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-white px-4 py-2.5">
            <span className="section-label">From base</span>
            {inherited.map((line) => (
              <span
                key={line.accessoryId}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
              >
                {line.accessory?.name} · {qty(line.perUnitQuantity)} {unitLabel(line.accessory)}
                {line.overridesBase && <span className="ml-1 text-indigo-600">replaced</span>}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-2 p-3">
          {!rows.length && (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-600">
                {isBase ? 'No base materials yet' : 'Nothing extra for this option'}
              </p>
            </div>
          )}

          {rows.map((row, index) => (
            <MaterialCard
              key={`${row.accessoryId}-${index}`}
              row={row}
              index={index}
              materials={materials}
              usedIds={usedIds}
              alsoInBase={!isBase && baseAccessoryIds.has(row.accessoryId)}
              onChange={update}
              onRemove={remove}
            />
          ))}

          <button type="button" className="btn-ghost w-full" onClick={add} disabled={materials.length === usedIds.size}>
            <MdAdd size={17} /> Add material
          </button>
        </div>
      </section>

      {blockedBy.length > 0 && (
        <div className="card-ui border-l-4 border-l-red-500 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-red-800">
            <MdWarningAmber size={16} /> Short on material
          </p>
          <p className="mt-1 text-[12px] text-slate-600">
            {blockedBy.map((line) => `${line.accessory?.name}: short ${qty(line.shortageQuantity)}`).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}
