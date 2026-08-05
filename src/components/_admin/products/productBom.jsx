'use client';

/**
 * The product material sheet.
 *
 * Structured around one rule that has to be legible at a glance: the base BOM
 * applies to every variation, always. It is not a scope you switch away from.
 *
 * The previous screen had a single "product option" dropdown and one table.
 * Choosing a variation loaded the *merged* list — base lines included — and
 * saving wrote all of it back as that variation's own rows. The base was
 * silently copied in, and from then on editing the base no longer reached that
 * variation. Nothing on screen said so.
 *
 * So: base and variations are edited separately and saved separately. A
 * variation panel shows only what that variation adds, with the inherited base
 * rows listed read-only above it so the total is never a mystery.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import {
  MdAdd, MdArrowBack, MdDeleteOutline, MdInfoOutline, MdLayers,
  MdReceiptLong, MdSave, MdTune, MdWarningAmber,
} from 'react-icons/md';

import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { alertError, toastSuccess } from 'src/utils/swal';

const qty = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1000) / 1000;
const money = (value) =>
  `BDT ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const unitLabel = (material) =>
  material?.unitMode === 'roll_meter' ? 'metres' : material?.unit?.name || 'units';

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

function MaterialRows({ rows, materials, usedIds, onChange, onRemove, baseAccessoryIds }) {
  return rows.map((row, index) => {
    const material = materials.find((item) => item.id === row.accessoryId);
    const perUnit = qty(Number(row.quantity || 0) * (1 + Number(row.wastagePercent || 0) / 100));
    const alsoInBase = baseAccessoryIds?.has(row.accessoryId);

    return (
      <div
        key={`${row.accessoryId}-${index}`}
        className="grid gap-3 border-t border-slate-100 px-5 py-4 lg:grid-cols-[minmax(200px,1.5fr)_110px_100px_120px_40px] lg:items-start"
      >
        <div>
          <select
            className="select-ui w-full font-semibold"
            value={row.accessoryId}
            onChange={(event) => onChange(index, { accessoryId: event.target.value })}
          >
            {materials.map((item) => (
              <option
                key={item.id}
                value={item.id}
                disabled={item.id !== row.accessoryId && usedIds.has(item.id)}
              >
                {item.name} · {item.code}
              </option>
            ))}
          </select>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
              {unitLabel(material)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                material?.isRepurchasable ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {material?.isRepurchasable ? 'Can be repurchased' : 'Cannot be repurchased'}
            </span>
          </div>

          {alsoInBase && (
            <label className="mt-2 flex items-start gap-2 rounded-md bg-indigo-50 px-2.5 py-2 text-[11px] text-indigo-900">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={row.overridesBase}
                onChange={(event) => onChange(index, { overridesBase: event.target.checked })}
              />
              <span>
                <strong>Replace</strong> the base amount instead of adding to it.
                <span className="block text-indigo-700">
                  {row.overridesBase
                    ? 'This variation ignores the base line for this material.'
                    : 'This amount is added on top of the base line.'}
                </span>
              </span>
            </label>
          )}

          <input
            className="input-ui mt-2"
            placeholder="Process note, e.g. cut before issue"
            value={row.note}
            onChange={(event) => onChange(index, { note: event.target.value })}
          />
        </div>

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

        <div>
          <span className="section-label mb-1 block">Consumes</span>
          <p className="text-sm font-bold text-slate-800">
            {perUnit} {unitLabel(material)}
          </p>
          <p className="text-[11px] text-slate-400">per finished unit</p>
        </div>

        <button
          type="button"
          className="btn-icon mt-4 text-red-600"
          aria-label={`Remove ${material?.name || 'material'}`}
          onClick={() => onRemove(index)}
        >
          <MdDeleteOutline size={19} />
        </button>
      </div>
    );
  });
}

/** One saveable scope: the base, or a single variation. */
function ScopePanel({
  title,
  subtitle,
  icon: Icon,
  rows,
  setRows,
  materials,
  baseAccessoryIds,
  onSave,
  isSaving,
  dirty,
  children,
}) {
  const usedIds = useMemo(() => new Set(rows.map((row) => row.accessoryId)), [rows]);

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

  return (
    <section className="card-ui overflow-hidden">
      <div className="flex flex-col gap-3 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-md bg-white p-2 text-slate-700 ring-1 ring-slate-200">
            <Icon size={19} />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-brand min-h-10 shrink-0"
          onClick={onSave}
          disabled={isSaving || !dirty}
        >
          <MdSave size={17} /> {isSaving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>

      {children}

      {!rows.length && (
        <div className="border-t border-slate-100 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-600">No materials here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-400">
            Add a line to record what one finished unit consumes.
          </p>
        </div>
      )}

      <MaterialRows
        rows={rows}
        materials={materials}
        usedIds={usedIds}
        baseAccessoryIds={baseAccessoryIds}
        onChange={update}
        onRemove={remove}
      />

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button type="button" className="btn-ghost" onClick={add} disabled={materials.length === usedIds.size}>
          <MdAdd size={17} /> Add material
        </button>
      </div>
    </section>
  );
}

function CostSummary({ scope, title }) {
  if (!scope) return null;
  const profit = Number(scope.estimatedProfit || 0);
  return (
    <div className="card-ui overflow-hidden">
      <div className="bg-slate-900 px-5 py-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight">{money(scope.estimatedTotalCost)}</p>
      </div>
      <dl className="divide-y divide-slate-100 px-5">
        {[
          ['Materials', money(scope.materialCost ?? scope.effective?.materialCost)],
          ['Production rate', money(scope.labourCost)],
          ['Selling price', money(scope.sellingPrice)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between py-2.5 text-[13px]">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between py-2.5 text-[13px]">
          <dt className="text-slate-500">Estimated profit</dt>
          <dd className={`font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{money(profit)}</dd>
        </div>
      </dl>
      {(scope.costComplete ?? scope.effective?.costComplete) === false && (
        <p className="border-t border-amber-200 bg-amber-50 px-5 py-2.5 text-[11px] font-semibold text-amber-800">
          Some materials have no purchase cost yet, so this estimate is incomplete.
        </p>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.slug
 * @param {boolean} [props.embedded] rendered as a step inside the product form
 *   rather than as its own page: drops the page chrome and the sidebar, since
 *   the form already supplies both.
 */
export default function ProductBom({ slug, embedded = false }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [baseRows, setBaseRows] = useState([]);
  const [variationRows, setVariationRows] = useState({});
  const [activeVariationId, setActiveVariationId] = useState('');
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
    if (!activeVariationId && variations.length) setActiveVariationId(variations[0].id);
  }, [variations, activeVariationId]);

  const saveMutation = useMutation(api.saveProductBom, {
    onSuccess: (response, sent) => {
      queryClient.setQueryData(['product-bom', slug], response);
      // The catalogue reads production capacity off the BOM.
      queryClient.invalidateQueries(['products']);
      toastSuccess(sent.variationId ? 'Variation materials saved' : 'Base materials saved');
    },
    onError: (error) => alertError(error, { title: 'Could not save materials' }),
  });

  const baseAccessoryIds = useMemo(() => new Set(baseRows.map((row) => row.accessoryId)), [baseRows]);
  const activeVariation = variations.find((variation) => variation.id === activeVariationId) || null;
  const activeRows = variationRows[activeVariationId] || [];

  const baseDirty = serialise(baseRows) !== saved.base;
  const activeDirty = activeVariationId
    ? serialise(activeRows) !== (saved.variations[activeVariationId] ?? '[]')
    : false;

  const setActiveRows = (updater) =>
    setVariationRows((current) => ({
      ...current,
      [activeVariationId]: typeof updater === 'function' ? updater(current[activeVariationId] || []) : updater,
    }));

  const save = (variationId, rows) =>
    saveMutation.mutate({
      slug,
      variationId: variationId || null,
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

  const inheritedForActive = (activeVariation?.effective?.lines || []).filter((line) => line.inheritsBase);

  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title={`${bom?.product?.name || 'Product'} materials`}
          subtitle="What one finished unit consumes, and what it costs to make"
          icon={MdReceiptLong}
        >
          <button className="btn-ghost min-h-11" onClick={() => router.push(`/products/${slug}`)}>
            <MdArrowBack size={18} /> Product details
          </button>
        </PageHeader>
      )}

      {!bom?.base?.lines?.length && (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <MdInfoOutline size={20} className="mt-0.5 shrink-0 text-slate-400" />
          <p className="text-[13px] text-slate-600">
            This product has no bill of materials. Orders will still go through — they simply carry no material
            reservation and no material cost until you add one.
          </p>
        </div>
      )}

      {/* Embedded, the product form already owns a right-hand column, so the
          costing panel stacks underneath instead of competing for width. */}
      <div className={embedded ? 'space-y-5' : 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]'}>
        <div className="space-y-5">
          <ScopePanel
            title="Base materials"
            subtitle="Applies to every variation of this product, always."
            icon={MdLayers}
            rows={baseRows}
            setRows={setBaseRows}
            materials={materials}
            onSave={() => save(null, baseRows)}
            isSaving={saveMutation.isLoading && !saveMutation.variables?.variationId}
            dirty={baseDirty}
          />

          {variations.length > 0 && (
            <ScopePanel
              title="Variation extras"
              subtitle={
                activeVariation
                  ? `Only for ${activeVariation.label}. Added on top of the base.`
                  : 'Pick a variation to add materials only it needs.'
              }
              icon={MdTune}
              rows={activeRows}
              setRows={setActiveRows}
              materials={materials}
              baseAccessoryIds={baseAccessoryIds}
              onSave={() => save(activeVariationId, activeRows)}
              isSaving={saveMutation.isLoading && Boolean(saveMutation.variables?.variationId)}
              dirty={activeDirty}
            >
              <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-5 py-3">
                {variations.map((variation) => {
                  const count = (variationRows[variation.id] || []).length;
                  const active = variation.id === activeVariationId;
                  return (
                    <button
                      key={variation.id}
                      type="button"
                      onClick={() => setActiveVariationId(variation.id)}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {variation.label}
                      {count > 0 && (
                        <span
                          className={`ml-1.5 rounded px-1 text-[10px] ${
                            active ? 'bg-white/20' : 'bg-white text-slate-500'
                          }`}
                        >
                          +{count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {inheritedForActive.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                  <p className="section-label mb-2">Inherited from base — edit above</p>
                  <div className="flex flex-wrap gap-1.5">
                    {inheritedForActive.map((line) => (
                      <span
                        key={line.accessoryId}
                        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200"
                      >
                        {line.accessory?.name} · {qty(line.perUnitQuantity)} {unitLabel(line.accessory)}
                        {line.overridesBase && <span className="ml-1 text-indigo-600">replaced</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </ScopePanel>
          )}
        </div>

        <aside
          className={
            embedded
              ? 'grid gap-4 sm:grid-cols-2'
              : 'space-y-4 xl:sticky xl:top-5 xl:self-start'
          }
        >
          <CostSummary scope={bom?.base} title="Base unit cost" />
          {activeVariation && (
            <CostSummary scope={activeVariation} title={`${activeVariation.label} unit cost`} />
          )}

          {activeVariation?.effective?.blockedBy?.length > 0 && (
            <div className="card-ui border-l-4 border-l-red-500 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-red-800">
                <MdWarningAmber size={16} /> Short on material
              </p>
              <ul className="mt-2 space-y-1 text-[12px] text-slate-600">
                {activeVariation.effective.blockedBy.map((line) => (
                  <li key={line.accessoryId}>
                    {line.accessory?.name}: short {qty(line.shortageQuantity)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                These cannot be repurchased, so an order needing them is refused rather than queued.
              </p>
            </div>
          )}

          <div className="card-ui p-4 text-[13px] text-slate-600">
            <p className="font-bold text-slate-800">How orders use this</p>
            <p className="mt-1.5 leading-6">
              Finished stock is reserved first. Remaining units reserve materials from this sheet. Repurchasable
              shortages wait for stock-in; non-repurchasable shortages stop the order.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
