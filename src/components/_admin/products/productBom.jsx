'use client';

import { useState } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { MdArrowBack, MdReceiptLong, MdSave } from 'react-icons/md';
import * as api from 'src/services';
import PageHeader from 'src/components/_admin/ui/PageHeader';
import { MaterialSlots, VariationMaterialsTable } from './BomSlots';
import { alertError, toastSuccess } from 'src/utils/swal';

const serialise = (rows) =>
  JSON.stringify(
    rows
      .map((row) => [
        row.id || row.defaultRequirementId || row.draftId,
        row.name || '',
        row.unitMode || '',
        row.accessoryId || null,
        row.categoryId || null,
        row.inheritQuantity ? null : Number(row.quantity),
        row.inheritQuantity ? null : Number(row.wastagePercent || 0),
        Boolean(row.inheritQuantity),
        row.note || ''
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  );
const sheetFrom = (bom) =>
  bom.slotSheet || {
    slots: bom.defaults?.slots || [],
    assignments: Object.fromEntries(bom.variations.map((variation) => [variation.id, variation.slots || []]))
  };
const invalidAmounts = (rows) =>
  rows.some(
    (row) =>
      row.inheritQuantity !== true &&
      (row.quantity === '' ||
        row.quantity == null ||
        !Number.isFinite(Number(row.quantity)) ||
        Number(row.quantity) < 0 ||
        row.wastagePercent === '' ||
        !Number.isFinite(Number(row.wastagePercent)) ||
        Number(row.wastagePercent) < 0 ||
        Number(row.wastagePercent) > 100)
  );

function BomEditor({ slug, embedded, bom, materials, categories }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [slots, setSlots] = useState(() => sheetFrom(bom).slots);
  const [assignments, setAssignments] = useState(() => sheetFrom(bom).assignments);
  const [savedSlots, setSavedSlots] = useState(() => serialise(sheetFrom(bom).slots));
  const [savedAssignments, setSavedAssignments] = useState(() =>
    Object.fromEntries(Object.entries(sheetFrom(bom).assignments).map(([id, rows]) => [id, serialise(rows)]))
  );
  const [backorderLimit, setBackorderLimit] = useState(bom.product.materialBackorderLimit || 0);
  const [savedBackorderLimit, setSavedBackorderLimit] = useState(bom.product.materialBackorderLimit || 0);
  const variations = bom.variations;
  const persistedSlots = sheetFrom(bom).slots;
  const slotChanges = serialise(slots) !== savedSlots || Number(backorderLimit) !== savedBackorderLimit;
  const variationDirty = (id) => serialise(assignments[id] || []) !== (savedAssignments[id] || '[]');
  const missingFor = (id) =>
    persistedSlots.filter((slot) => {
      const binding = (assignments[id] || []).find((row) => row.defaultRequirementId === slot.id);
      if (Number(binding?.inheritQuantity === false ? binding.quantity : slot.quantity) === 0) return false;
      const material = materials.find((row) => row.id === (binding?.accessoryId || slot.accessoryId));
      return !material || material.isActive === false || (slot.categoryId && material.categoryId !== slot.categoryId);
    });
  const saveMutation = useMutation(api.saveProductBom, {
    onSuccess: (response, sent) => {
      const sheet = sheetFrom(response.data);
      if (sent.variationAssignments) {
        const ids = sent.variationAssignments.map((edit) => edit.variationId);
        setAssignments((current) => ({
          ...current,
          ...Object.fromEntries(ids.map((id) => [id, sheet.assignments[id] || []]))
        }));
        setSavedAssignments((current) => ({
          ...current,
          ...Object.fromEntries(ids.map((id) => [id, serialise(sheet.assignments[id] || [])]))
        }));
      } else if (!sent.variationId) {
        setSlots(sheet.slots);
        setSavedSlots(serialise(sheet.slots));
        setSavedBackorderLimit(Number(sent.materialBackorderLimit || 0));
        const allowed = new Set(sheet.slots.map((slot) => slot.id));
        setAssignments((current) =>
          Object.fromEntries(
            Object.entries(current).map(([id, rows]) => [
              id,
              rows.filter((row) => allowed.has(row.defaultRequirementId))
            ])
          )
        );
        setSavedAssignments((current) =>
          Object.fromEntries(
            Object.entries(current).map(([id, saved]) => [
              id,
              JSON.stringify(JSON.parse(saved).filter((row) => allowed.has(row[0])))
            ])
          )
        );
      } else {
        const rows = sheet.assignments[sent.variationId] || [];
        setAssignments((current) => ({ ...current, [sent.variationId]: rows }));
        setSavedAssignments((current) => ({ ...current, [sent.variationId]: serialise(rows) }));
      }
      queryClient.setQueryData(['product-bom', slug], response);
      queryClient.invalidateQueries(['products']);
      toastSuccess(sent.variationAssignments ? 'Variation assignments saved' : 'Material slots saved');
    },
    onError: (error) => alertError(error, { title: 'Could not save materials' })
  });
  const saveSlots = () => {
    if (invalidAmounts(slots) || slots.some((slot) => !slot.name.trim()))
      return alertError(new Error('Enter a slot name, a non-negative amount and a waste percentage from 0 to 100.'), {
        title: 'Check material slots'
      });
    saveMutation.mutate({
      slug,
      slotOnly: true,
      variationId: null,
      lines: [],
      materialBackorderLimit: Number(backorderLimit),
      slots: slots.map((slot) => ({
        ...(slot.id && { id: slot.id }),
        name: slot.name,
        unitMode: slot.unitMode,
        categoryId: slot.categoryId || null,
        accessoryId: slot.accessoryId || null,
        quantity: Number(slot.quantity),
        wastagePercent: Number(slot.wastagePercent || 0),
        note: slot.note || ''
      }))
    });
  };
  const dirtyVariations = variations.filter((variation) => variationDirty(variation.id));
  const saveVariations = () => {
    if (dirtyVariations.some((variation) => invalidAmounts(assignments[variation.id] || [])))
      return alertError(
        new Error('Enter a non-negative quantity and a waste percentage from 0 to 100 for each slot.'),
        { title: 'Check variation amounts' }
      );
    saveMutation.mutate({
      slug,
      slotOnly: true,
      lines: [],
      variationAssignments: dirtyVariations.map((variation) => ({
        variationId: variation.id,
        slots: (assignments[variation.id] || []).map((row) => ({
          defaultRequirementId: row.defaultRequirementId,
          accessoryId: row.accessoryId || null,
          inheritQuantity: row.inheritQuantity !== false,
          ...(row.inheritQuantity === false && { quantity: Number(row.quantity) }),
          wastagePercent: Number(row.wastagePercent || 0),
          note: row.note || ''
        }))
      }))
    });
  };
  const missingCount = variations.reduce((sum, variation) => sum + missingFor(variation.id).length, 0);
  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title={`${bom.product.name} materials`}
          subtitle="Material slots and variation assignments"
          icon={MdReceiptLong}
        >
          <button type="button" className="btn-ghost min-h-11" onClick={() => router.push(`/products/${slug}`)}>
            <MdArrowBack size={18} /> Product details
          </button>
        </PageHeader>
      )}
      <fieldset disabled={saveMutation.isLoading} className="min-w-0 space-y-5">
        <MaterialSlots
          slots={slots}
          materials={materials}
          categories={categories}
          onChange={setSlots}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <span>Material backorder limit</span>
                <input
                  className="input-ui !h-10 w-20"
                  aria-label="Material backorder limit"
                  title="Maximum pieces allowed to wait for repurchasable materials. Zero requires stock."
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  value={backorderLimit}
                  onChange={(event) => setBackorderLimit(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn-brand min-h-11"
                disabled={!slotChanges || saveMutation.isLoading}
                onClick={saveSlots}
              >
                <MdSave size={16} />{' '}
                {saveMutation.isLoading && !saveMutation.variables?.variationAssignments ? 'Saving...' : 'Save slots'}
              </button>
            </div>
          }
        />
        <VariationMaterialsTable
          slots={persistedSlots}
          variations={variations}
          assignments={assignments}
          materials={materials}
          categories={categories}
          onChange={(id, rows) => setAssignments((current) => ({ ...current, [id]: rows }))}
          dirtyFor={variationDirty}
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Variations</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Each variation lists its material slots below one another.
                </p>
              </div>
              <button
                type="button"
                className="btn-brand min-h-11"
                disabled={!dirtyVariations.length || saveMutation.isLoading || slotChanges}
                onClick={saveVariations}
              >
                <MdSave size={16} />{' '}
                {saveMutation.isLoading && saveMutation.variables?.variationAssignments
                  ? 'Saving...'
                  : 'Save variations'}
              </button>
            </div>
          }
          footer={
            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
              <p role="status" className={slotChanges ? 'text-amber-700' : ''}>
                {slotChanges
                  ? 'Save slot changes before saving variations.'
                  : dirtyVariations.length
                    ? dirtyVariations.length + ' variation(s) with unsaved changes'
                    : 'Uses slot defaults until changed. Reset a cell to restore its default.'}
              </p>
              {missingCount > 0 && <p className="text-amber-700">{missingCount} accessory assignment(s) needed</p>}
            </div>
          }
        />
      </fieldset>
    </div>
  );
}

export default function ProductBom({ slug, embedded = false }) {
  const bomQuery = useQuery(['product-bom', slug], () => api.getProductBom({ slug }), { refetchOnWindowFocus: false });
  const materialsQuery = useQuery(['bom-materials'], api.getBomMaterials);
  const categoriesQuery = useQuery(['bom-categories'], api.getBomCategories);
  if (bomQuery.isLoading || materialsQuery.isLoading || categoriesQuery.isLoading)
    return <div className="card-ui h-[520px] animate-pulse bg-slate-100" />;
  if (bomQuery.isError || materialsQuery.isError || categoriesQuery.isError)
    return (
      <div className="card-ui p-8 text-center">
        <p className="font-semibold text-rose-700">The material sheet could not be loaded.</p>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => {
            bomQuery.refetch();
            materialsQuery.refetch();
            categoriesQuery.refetch();
          }}
        >
          Try again
        </button>
      </div>
    );
  if (!bomQuery.data?.data) return null;
  return (
    <BomEditor
      key={slug}
      slug={slug}
      embedded={embedded}
      bom={bomQuery.data.data}
      materials={materialsQuery.data?.data || []}
      categories={categoriesQuery.data?.data || []}
    />
  );
}
